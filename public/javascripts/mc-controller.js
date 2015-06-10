/**
 * Created by thorul on 30/03/2015.
 */

module.controller("mcController", ['$scope', '$cookieStore', 'mcService', function($scope, $cookieStore, mcService) {

    var uname = $cookieStore.get("cronacle-username");
    var pwd = $cookieStore.get("cronacle-password");

    if (uname == null)
        uname = "";
    if (pwd == null)
        pwd = "";

    $scope.credentials = {
        cronacle_username: uname,
        cronacle_password: pwd
    };

    $scope.crjobs = { };
    $scope.cronacle_env = "PRD";
    $scope.days_ago = "2";
    $scope.busy = 0;
    $scope.dayOfWeek = "";
    $scope.analysis = [];
    $scope.afterBankHoliday = false;

    console.log("Hello from the controller");

    // getNodeData();
    /*
    plotJobGraph([{"jobStartDay":"23/4", "jobElapsed":"35"}, {"jobStartDay":"25/4", "jobElapsed":"102"},
        {"jobStartDay":"26/4", "jobElapsed":"80"}, {"jobStartDay":"27/4", "jobElapsed":"72"}, {"jobStartDay":"28/4", "jobElapsed":"109"},
        {"jobStartDay":"29/4", "jobElapsed":"67"},
        {"jobStartDay":"30/4", "jobElapsed":"91"},
        {"jobStartDay":"1/5", "jobElapsed":"42"}], "TEST");
    */

    $scope.showStats = function(jobName) {
        console.log("Displaying stats for " + jobName);
        var s = getJobStats(jobName);
        console.dir(s);
        if (s.length > 0) {
            plotJobGraph(s, jobName);
        }
        else { console.log("Empty stats."); }
    };

    $scope.getStatus = function() {
        $scope.busy = 1;

        // If on a Monday or bank holiday make sure we gather stats from a couple of days
        var d = new Date();
        if ((d.getDay() == 1 && $scope.days_ago < "3"))
            $scope.days_ago = "3";
        if (($scope.afterBankHoliday && $scope.days_ago < "4"))
            $scope.days_ago = "4";

        $cookieStore.put('cronacle-username', $scope.credentials["cronacle_username"]);
        $cookieStore.put('cronacle-password', $scope.credentials["cronacle_password"]);
        mcService.getStatus( $scope.credentials["cronacle_username"],
            $scope.credentials["cronacle_password"], $scope.cronacle_env, $scope.days_ago,
            function(jobs) {
                $scope.busy = 0;
                console.log("Got jobs: " + jobs);
                $scope.crjobs = jobs;
                checkRules();
            });

    }

    // For a given job find out:
    // 1. Minutes since last successful completion
    // 2. Number of currently running instances
    // 3. Next run due in X minutes
    var getJobDetails = function(jobGroup, jobName, recentHorizon, callback) {
        // If on a Monday we need to look at Friday's batch.

        // Look for the most recently completed instance
        var details = {
            since: 9999,
            running: 0,
            ctime: "",
            nextRunDueIn: -1,
            nextRunDue: "",
            recentlyCompleted: 0
        };

        recentHorizon += 5; // Give us some margin in case a job finishes under 1 minute.
        // console.log("Processing: " + jobName + ", horizon = " + recentHorizon);

        $scope.crjobs[jobGroup].forEach(function(job) {
            if (job["jobName"] == jobName) {
                if (job["jobStatus"] == "COMPLETED") {
                    var s = parseInt(job["minutesSinceCompletion"]);
                    // console.log("s = " + s);
                    if (s < details.since) {
                        details.since = s;
                        details.ctime = job["jobEnd"];
                    }
                    if (s < recentHorizon)
                        details.recentlyCompleted++;
                }
                if (job["jobStatus"] == "WAITING") {
                    details.running++;
                }
                if (job["jobStatus"] == "SCHEDULED" || job["jobStatus"] == "CHAINED") {
                    details.nextRunDueIn = job["jobNextStartDue"];
                    details.nextRunDue = job["jobExpectedStart"];
                }
            }
        });

        callback(details);
    }

    var logger = function(severity, message) {
        $scope.analysis.push({sev: severity, msg: message});
    };

    // Check a set of business rules found on the wiki page:
    // http://wiki.uk.mizuho-sc.com:8090/display/MARS/MARS+Morning+Checks
    var checkRules = function() {

        // Reset
        $scope.analysis = [];

        var timeFactor = ( $scope.crjobs["dayOfWeek"].trim() == "MONDAY") ? 48 * 60 : 0;
        if ($scope.afterBankHoliday)
            timeFactor = 72 * 60;
        var fridayDueAddition = ( $scope.crjobs["dayOfWeek"].trim() == "FRIDAY") ? 48 * 60 : 0;

        // Calculate how many minutes are left of today.
        var d = new Date();
        var minutesLeftToday = (23 - d.getHours() ) * 60 + ( 60 - d.getMinutes());
        var minutesGoneToday = (d.getHours() ) * 60 + ( d.getMinutes());
        var horizon = 0;

        // Check the MARS overnight batch
        horizon = minutesGoneToday + timeFactor;
        getJobDetails("mars-batch", "MARS_OVERNIGHT_BATCH", horizon, function(details) {
            if (details.recentlyCompleted > 0)
                logger("INFO", "MARS batch completion seems OK. The most recent one " +
                    "completed at " + details.ctime);
            else {
                if (details.running == 0)
                    logger("ERROR", "No MARS batch completed recently and " +
                    "none is running. The last one completed at " + details.ctime);
                else
                    logger("ERROR", "No MARS batch completed recently but there " +
                    ( ( details.running > 1 ) ? "are " + details.running : "is one" ) +
                    " running now. The last one completed at " + details.ctime);
            }
            if (details.running == 0)
                logger("INFO", "There are no running MARS batches at the moment.");
            else
                logger("WARN", "There " + (( details.running > 1 ) ? "are " + details.running + " MARS batches" :
                    "is one MARS batch") + " running now.");
            if (details.nextRunDueIn < 0)
                logger("WARN", "There are no scheduled MARS batches.");
            else if (details.nextRunDueIn < minutesLeftToday)
                logger("INFO", "The next MARS batch is scheduled to run TODAY at: " +
                    details.nextRunDue);
            else
                logger("WARN", "There is no MARS batch scheduled for today. " +
                "The next one is scheduled to run at: " + details.nextRunDue);
        });

        // RISKBIPRU_FULL_BATCH should have run at 03:30 this morning.
        horizon = minutesGoneToday - 220 + timeFactor;
        getJobDetails("sundry-jobs", "Full BIPRU Batch - All Streams", horizon, function(details) {
            if (details.recentlyCompleted > 0)
                logger("INFO", "BIPRU Batch completion seems OK. The most recent one " +
                "completed at " + details.ctime);
            else
                logger("ERROR", "I cannot find a recent BIPRU Batch. The most recent one " +
                "completed at " + details.ctime);
            if (details.nextRunDueIn < minutesGoneToday - details.since + 24*60 + timeFactor && details.nextRunDueIn >= 0)
                logger("INFO", "The next BIPRU batch is scheduled for: " + details.nextRunDue);
            else
                logger("ERROR", "The next BIPRU batch is scheduled for: " + details.nextRunDue);
        });

        // RISKON_REFRESH_STATIC should have run at 03:30 this morning.
        horizon = minutesGoneToday - 210 + timeFactor;
        getJobDetails("sundry-jobs", "Dumps RiskShared and restores to RiskSharedStatic", horizon, function(details) {
            if (details.recentlyCompleted > 0)
                logger("INFO", "Static refresh completion seems OK. The most recent one " +
                "completed at " + details.ctime);
            else
                logger("ERROR", "I cannot find a recent Static refresh. The most recent one " +
                "completed at " + details.ctime);
            if (details.nextRunDueIn < minutesGoneToday - details.since + 24*60 + timeFactor && details.nextRunDueIn >= 0)
                logger("INFO", "The next Static refresh is scheduled for: " + details.nextRunDue);
            else
                logger("ERROR", "The next Static refresh is scheduled for: " + details.nextRunDue);
        });

        // CRLM_DAILY_RUN should run 04:00 each business day.
        horizon = minutesGoneToday - 240 + timeFactor;
        getJobDetails("sundry-jobs", "CRLM_DAILY_RUN", horizon, function(details) {
            if (details.recentlyCompleted > 0)
                logger("INFO", "CRLM completion seems OK. The most recent one " +
                "completed at " + details.ctime);
            else
                logger("ERROR", "I cannot find a recent CRLM run. The most recent one " +
                "completed at " + details.ctime);
            if (details.nextRunDueIn < minutesGoneToday - details.since + 24*60 +
                fridayDueAddition && details.nextRunDueIn >= 0)
                logger("INFO", "The next CRLM run is scheduled for: " + details.nextRunDue);
            else
                logger("ERROR", "The next CRLM run is scheduled for: " + details.nextRunDue);
        });

        // TCRM Extract
        horizon = minutesGoneToday - 360 + timeFactor;
        getJobDetails("sundry-jobs", "Extract data for TCRM", horizon, function(details) {
            if (details.recentlyCompleted > 0)
                logger("INFO", "TCRM completion seems OK. The most recent one " +
                "completed at " + details.ctime);
            else
                logger("ERROR", "I cannot find a recent TCRM extract. The most recent one " +
                "completed at " + details.ctime);
            if (details.nextRunDueIn < minutesGoneToday - details.since + 24*60 && details.nextRunDueIn >= 0)
                logger("INFO", "The next TCRM extract is scheduled for: " + details.nextRunDue);
            else
                logger("ERROR", "The next TCRM extract is scheduled for: " + details.nextRunDue);
        });

        // MI Curves @17:30.
        horizon = minutesGoneToday + 420 + timeFactor;
        getJobDetails("sundry-jobs", "RISK_PROCESS_MI_CORE_CURVES", horizon, function(details) {
            if (details.recentlyCompleted > 0)
                logger("INFO", "MI Curves completion seems OK. The most recent one " +
                "completed at " + details.ctime);
            else
                logger("ERROR", "I cannot find a recent MI Curves run. The most recent one " +
                "completed at " + details.ctime);
            if (details.nextRunDueIn < minutesGoneToday - details.since + 24*60 + timeFactor && details.nextRunDueIn >= 0)
                logger("INFO", "The next MI Curves run is scheduled for: " + details.nextRunDue);
            else
                logger("ERROR", "The next MI Curves is scheduled for: " + details.nextRunDue);
        });

        // RISKGEV_LOAD_TOKYO_FILES around @03:30 - 04:30.
        horizon = minutesGoneToday - 210 + timeFactor;
        getJobDetails("sundry-jobs", "RISKGEV_LOAD_TOKYO_FILES", horizon, function(details) {
            if (details.recentlyCompleted > 0)
                logger("INFO", "Tokyo files completion seems OK. The most recent one " +
                "completed at " + details.ctime);
            else
                logger("ERROR", "I cannot find a recent Tokyo files load. The most recent one " +
                "completed at " + details.ctime);
            if (details.nextRunDueIn < minutesGoneToday - details.since + 24*60 && details.nextRunDueIn >= 0)
                logger("INFO", "The next Tokyo files load is scheduled for: " + details.nextRunDue);
            else
                logger("INFO", "The next Tokyo files load is usually scheduled from the MARS batch.");
        });

        // RISKID_GVAR_FXPOSNS_ARRIVED @12:00.
        horizon = ( minutesGoneToday > 12*60 ) ? minutesGoneToday - 12*60 + timeFactor :
            minutesGoneToday + 12*60 + timeFactor;
        getJobDetails("sundry-jobs", "RISKID_GVAR_FXPOSNS_ARRIVED", horizon, function(details) {
            if (details.recentlyCompleted > 0)
                logger("INFO", "GVAR Pos Arrived completion seems OK. The most recent one " +
                "completed at " + details.ctime);
            else
                logger("ERROR", "I cannot find a recent GVAR Pos Arrived run. The most recent one " +
                "completed at " + details.ctime);
            if (details.nextRunDueIn < minutesGoneToday - details.since + 24*60 + timeFactor && details.nextRunDueIn >= 0)
                logger("INFO", "The next GVAR Pos Arrived run is scheduled for: " + details.nextRunDue);
            else
                logger("ERROR", "The next GVAR Pos Arrived run is scheduled for: " + details.nextRunDue);
        });

        // Load Euroclear TriParty details happens 20:15 at the end of each business day.
        horizon = minutesGoneToday + 4*60 + timeFactor;
        getJobDetails("sundry-jobs", "Load Euroclear TriParty details", horizon, function(details) {
            if (details.recentlyCompleted > 0)
                logger("INFO", "EC TriParty completion seems OK. The most recent one " +
                "completed at " + details.ctime);
            else
                logger("ERROR", "I cannot find a recent EC TriParty run. The most recent one " +
                "completed at " + details.ctime);
            if (details.recentlyCompleted > 1)
                logger("ERROR", "I found multiple recent EC TriParty runs completed. " +
                    "Please investigate.");
            logger("INFO", "EC TriParty loads are scheduled from within the batch.");
        });
    };

    // For a given job get the list of runs:
    var getJobStats = function(jobName) {
        var retVal = [];
        // Find the first job that matches jobName
        $scope.crjobs["job-stats"].some(function(jobRuns) {
            if (jobRuns["jobName"] == jobName)
                retVal = jobRuns["runs"];
            return jobRuns["jobName"] == jobName;
        });
        return retVal;
    }

    function shuffle(myArray) {
        var currentIndex = myArray.length
            , temporaryValue
            , randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = myArray[currentIndex];
            myArray[currentIndex] = myArray[randomIndex];
            myArray[randomIndex] = temporaryValue;
        }

        return myArray;
    }

    function getNodeData() {
        var graph = {
            "nodes":[],
            "links":[]
        };

        var myGroup = [];
        var groups = [];
        var paths = [];

        // Create 100 nodes
        for (var i=0; i<100; i++) {
            var grp = Math.floor(Math.random()*10) + 1;
            if (i<11)
                grp = i;
            if (i==0)
                grp=0;
            myGroup[i] = grp;
            if (typeof(groups[grp]) == 'undefined')
                groups[grp] = [];
            groups[grp].push(i);
            graph["nodes"].push({"name":"Node-"+i, "group":grp});
        }

        // Create links to group leaders (1-10) from the source
        for (var i=1; i<11; i++) {
            var v = Math.floor(Math.random()*100) + 10;
            graph["links"].push({"source":0, "target":i, "value":v});
        }

        // Create links from group leaders to nodes
        for (var i=11; i<100; i++) {
            var grp = myGroup[i];
            var v = Math.floor(Math.random()*100) + 1;
            graph["links"].push({"source":grp, "target":i, "value":v});
        }

        // Create intra-group links
        for (var grp=1; grp<11; grp++) {
            for (var t=0; t<3; t++) {
                groups[grp] = shuffle(groups[grp]);
                for (var i=0; i<groups[grp].length-1; i++) {
                    var r = Math.floor(Math.random()*3) + 1;
                    if (r > 1) {
                        var v = Math.floor(Math.random()*10) + 1;
                        graph["links"].push({"source":groups[grp][i],
                            "target":groups[grp][i+1], "value":v});
                    }
                }
            }
        }

        drawNodeStats(graph);

         // d3.json("../json/traffic_data.json", function(error, graph) {
    }

    // D3 Graphics
    function drawNodeStats(graph) {
        var width = 800,
            height = 500;

        var color = d3.scale.category20();

        var force = d3.layout.force()
            .linkDistance(10)
            .linkStrength(3)
            .size([width, height]);

        // Get rid of the SVG if there's already one there.
        var s = d3.select("#hive-path").select("svg");
        if (s != null)
            s.remove();

        // Set up a new one
        var svg = d3.select("#hive-path").append("svg")
            .attr("width", width)
            .attr("height", height);

        var nodes = graph.nodes.slice(),
            links = [],
            bilinks = [];

        graph.links.forEach(function(link) {
            var s = nodes[link.source],
                t = nodes[link.target],
                i = {}; // intermediate node to trigger curved path
            nodes.push(i);
            links.push({source: s, target: i}, {source: i, target: t});
            bilinks.push([s, i, t]);
        });

        force
            .nodes(nodes)
            .links(links)
            .start();

        var link = svg.selectAll(".link")
            .data(bilinks)
            .enter().append("path")
            .attr("class", "link");

        var node = svg.selectAll(".node")
            .data(graph.nodes)
            .enter().append("circle")
            .attr("class", "hive-path-node")
            .attr("r", 5)
            .style("fill", function(d) { return color(d.group); })
            .call(force.drag);

        node.append("title")
            .text(function(d) { return d.name; });

        force.on("tick", function() {
            link.attr("d", function(d) {
                return "M" + d[0].x + "," + d[0].y
                    + "S" + d[1].x + "," + d[1].y
                    + " " + d[2].x + "," + d[2].y;
            });
            node.attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            });
        });
    }

    function mouseovered(d) {
        hNode
            .each(function(n) { n.target = n.source = false; });

        hLink
            .classed("link--target", function(l) { if (l.target === d) return l.source.source = true; })
            .classed("link--source", function(l) { if (l.source === d) return l.target.target = true; })
            .filter(function(l) { return l.target === d || l.source === d; })
            .each(function() { this.parentNode.appendChild(this); });

        hNode
            .classed("node--target", function(n) { return n.target; })
            .classed("node--source", function(n) { return n.source; });
    }

    function mouseouted(d) {
        hLink
            .classed("link--target", false)
            .classed("link--source", false);

        hNode
            .classed("node--target", false)
            .classed("node--source", false);
    }

    // d3.select(self.frameElement).style("height", diameter + "px");

    // Lazily construct the package hierarchy from class names.
    function packageHierarchy(classes) {
        var map = {};

        function find(name, data) {
            var node = map[name], i;
            if (!node) {
                node = map[name] = data || {name: name, children: []};
                if (name.length) {
                    node.parent = find(name.substring(0, i = name.lastIndexOf(".")));
                    node.parent.children.push(node);
                    node.key = name.substring(i + 1);
                }
            }
            return node;
        }

        classes.forEach(function(d) {
            find(d.name, d);
        });

        return map[""];
    }

    // Return a list of imports for the given array of nodes.
    function packageImports(nodes) {
        var map = {},
            imports = [];

        // Compute a map from name to node.
        nodes.forEach(function(d) {
            map[d.name] = d;
        });

        // For each import, construct a link from the source to target node.
        nodes.forEach(function(d) {
            if (d.imports) d.imports.forEach(function(i) {
                imports.push({source: map[d.name], target: map[i]});
            });
        });

        return imports;
    }

    // Plot run times
    function plotJobGraph(data, title) {
        // var filterExpr = new RegExp("(\[video\]\w+([0-9]+))", "i");
        // filterExpr.compile();

        // Trim data
        while (data.length > 20) {
            data.shift();
        }

        var ww = $( window ).width()-200;
        var hh = $( window ).height()-100;

        $("#graph").dialog({
            width: ww,
            height: hh,
            title: "Job History - " + title,
            resizable: false,
            hide: {
                effect: "explode",
                duration: 300
            }

        });

        var dataSet = [];
        var colors = ['yellow', 'orange', 'steelblue', '#00ff00',
            '#a0a0a0', '#bc4923', '#981288', '#ffffff', '#10cc98',
            '#cc8888'];
        var header = [ "Elapsed mins" ];
        var xAxisValues = [];
        var tstamps = [];
        var ts_last = 0;

        // Initialise dataSet with an empty array
        dataSet.push([]);

        var sample = 0,
            margin = {top: 5, right: 100, bottom: 30, left: 50},
            w = $("#graph").width() - margin.left - margin.right -20,
            h = $("#graph").height() - margin.top - margin.bottom -20;

        d3.select("#TheGraph").remove();

        var max1 = 0, min1, ts_first, ts_last;
        for (var pt=0; pt<data.length; pt++) {
            if (true) {
                tstamps.push(data[pt].jobStartDay);
                var tstamp = data[pt].jobStartDay;
                if (ts_first == undefined) { ts_first = tstamp; ts_last = tstamp; }
                if (tstamp > ts_last) ts_last = tstamp;
                var minCandidate = parseInt(data[pt].jobElapsed);
                var maxCandidate = parseInt (data[pt].jobElapsed);

                // Fix max and min values
                if (min1 == undefined) { min1 =  minCandidate; }
                if (minCandidate < min1) { min1 = minCandidate; }
                if (maxCandidate > max1) max1 = maxCandidate;

                ts_last = data[pt].jobStartDay;

                console.log("Pushing " + ts_last + ", min1=" + min1 + ", max1=" + max1);
                // dataSet[0].push({x:ts_last, y:data[pt].jobElapsed});
                dataSet[0].push({x:data[pt].jobStartDay, y:data[pt].jobElapsed});
                sample++;
            }
        }
        // var parseDate = d3.time.format("%Y-%m-%d").parse;
        // var dataSet = [ mtrElapsed, mtrP2PBps, mtrFBBps, mtrBufferings ];
        // max1 = 500;

        // Samples per series
        var totalSamples = sample;
        sample = ( sample > 10 ) ? 10 : sample;
        /*
         var xScale = d3.scale.linear().domain([0, sample-1]).range([margin.left, w]);
         // var xScale = d3.scale.ordinal().domain(xAxisValues).range([margin.left, w]);
         // var xScale = d3.scale.ordinal().domain(tstamps).rangePoints([margin.left, w]);
         // var xScale = d3.scale.ordinal().domain(tstamps).rangeRoundBands([margin.left, w]);
         */
        var y1 = d3.scale.linear()
            .domain([min1, max1*1.05])
            .range([h+margin.top,margin.top]);

        console.log("tstamps = " + tstamps+ ", margin.left/w=" + margin.left + "/" + w);

        var xScale = d3.scale.ordinal()
            .domain(tstamps)
            //.rangeRoundBands([0, w+margin.left+margin.right], 1);
            .rangeBands([0+margin.left, w+margin.left], 1, 0.1);
        console.log("margin.left=" + margin.left + ", w=" + w);
        console.log("margin.right=" + margin.right + ", w=" + w);

        var xAxis = d3.svg.axis()
            .scale(xScale)
            .orient("bottom")
            .ticks(sample);

        // alert(min1 + "/" + max1 + "  -  Testing scale value for 15:36:55 => " + xScale("15:36:55"));

        // create a line function that can convert data[] into x and y points
        var line1 = d3.svg.line()
            // .interpolate("basis")
            // assign the X function to plot our line as we wish
            .x(function(d,i) {
                // verbose logging to show what's actually being done
                // console.log('Plotting X1 value for data point: ' + d.x + ' using index: ' + i + '/' + sample + ' to be at: ' + xScale(d.x) + ' using our xScale.');
                // return the X coordinate where we want to plot this datapoint
                return xScale(d.x);
            })
            .y(function(d) {
                // verbose logging to show what's actually being done
                // console.log('Plotting Y1 value for data point: ' + d.y + ' to be at: ' + y1(d.y) + "/" + h + "/" + max1 + " using our y1 scale.");
                // return the Y coordinate where we want to plot this datapoint
                return y1(d.y);
            });

        // create an area function that can convert data[] into x and y points
        var area1 = d3.svg.area()
            // .interpolate("basis")
            // assign the X function to plot our line as we wish
            .x(function(d,i) {
                // verbose logging to show what's actually being done
                // console.log('Plotting X1 value for data point: ' + d.x + ' using index: ' + i + '/' + sample + ' to be at: ' + xScale(d.x) + ' using our xScale.');
                // return the X coordinate where we want to plot this datapoint
                return xScale(d.x);
            })
            .y0(h+margin.top)
            .y1(function(d) {
                // verbose logging to show what's actually being done
                // console.log('Plotting Y1 value for data point: ' + d.y + ' to be at: ' + y1(d.y) + "/" + h + "/" + max1 + " using our y1 scale.");
                // return the Y coordinate where we want to plot this datapoint
                return y1(d.y);
            });

        // Add an SVG element with the desired dimensions and margin.
        var graph = d3.select("#graph")
            .append("svg")
            .attr("width", w + margin.left + margin.right)
            .attr("height", h + margin.bottom + margin.top)
            .attr("id", "TheGraph");


        console.log("Creating xaxis with " + sample + " samples.");
        var xAxisGrid = xAxis.ticks(sample)
            .tickSize(h -margin.top, 0 )
            .tickFormat(function(d) { return d; })
            .orient("bottom");


        // X Axis
        graph.append("svg:g")
            .classed("xgrid", "true")
            .attr("transform", "translate(0," + (margin.top + 20) + ")") // Placement of labels
            .call(xAxisGrid);
        /*
         .call(make_x_axis(xScale, sample)
         .tickSize(h+margin.top - 10)
         .tickFormat(function(d) { return d; })
         */

        // Y Axis
        graph.append("svg:g")
            .classed("grid", "true")
            .attr("transform", "translate(45,0)")
            .call(make_y_axis(y1)
                //.tickSize(-w - margin.left - margin.right, 0, 0)
                .tickSize(-w,0,0)
                .tickFormat(d3.format("0f"))
        );

        // Draw the lines
        for (var gn=0; gn < dataSet.length; gn++) {
            // for (var gn=3; gn<4; gn++) {
            // graph.append("svg:path").attr("d", area1(dataSet[gn])).classed("data1 area", "true");
            var l = graph.append("svg:path")
                .attr("d", (gn==0)? area1(dataSet[gn]) : line1(dataSet[gn]))
                .attr("stroke", colors[gn])
                .style("fill", (gn==0) ? colors[gn] : "none")
                .style("fill-opacity", 0.2)
                .style("stroke-opacity", 0.5)
                .style("stroke-width", 4);

            //if (gn==dataSet.length)
            //  l.moveTo

        }
        /*
         graph.append("svg:path").attr("d", line1(mtrP2PBps)).attr("class", "data2");
         graph.append("svg:path").attr("d", line1(mtrFBBps)).attr("class", "data3");
         graph.append("svg:path").attr("d", line1(mtrBufferings)).attr("class", "data4");
         */

        var legend = graph.append("g")
            .attr("class", "legend");

        // Draw a small rectangle next to the legend text
        legend.selectAll('rect')
            .data(dataSet)
            .enter()
            .append("rect")
            .attr("x", margin.right + w - 40 )
            .attr("y", function(d, i){ return i *  20 + 9;})
            .attr("width", 10)
            .attr("height", 10)
            .style("fill", function(d) {
                var color = colors[dataSet.indexOf(d)];
                return color;
            })

        legend.selectAll('text')
            .data(dataSet)
            .enter()
            .append("text")
            .attr("class", "legend-text")
            .attr("x", margin.right + w - 20)
            .attr("y", function(d, i){ return i *  20 + 19;})
            .style("fill", "white")
            .text(function(d) {
                var text = header[dataSet.indexOf(d)];
                return text;
            });

        // ZOOMING //
        /*
         var zoomSVG = d3.select("#zoomSVG");
         var zoomRect = d3.select("#zoomRect");
         var zoom = d3.behavior.zoom()
         .scaleExtent([Math.pow(2, -2), Math.pow(2,10)])
         .on("zoom", function () {
         thePlot.xScale(xScale).update();
         });

         zoomSVG.attr("width", document.getElementById("chartContainer").offsetWidth)
         .attr("height", plotHeight);

         zoomRect.attr("width", document.getElementById("chartContainer").offsetWidth - margin.left - margin.right)
         .attr("height", plotHeight)
         .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

         zoomRect.attr("fill", "rgba(0,0,0,0)")
         .call(zoom);

         // apply zooming
         xScale = thePlot.xScale();
         yScale = thePlot.yScale();
         zoom.x(xScale);
         zoom.y(yScale);


         // UPDATING LINES //

         function changeLines () {
         thePlot.setSelectedLines().update();
         }

         document.getElementById("render-lines").addEventListener("change", changeLines, false);
         document.getElementById("render-depth").addEventListener("change", changeLines, false);
         document.getElementById("render-method").addEventListener("change", changeLines, false);
         */

        function make_x_axis(xScale, maxTicks) {
            return d3.svg.axis()
                .scale(xScale)
                .orient("bottom")
                .ticks(maxTicks)
        }

        function make_y_axis(yScale) {
            return d3.svg.axis()
                .scale(yScale)
                .orient("left")
                .ticks(20)
        }

        function wrap(text, width) {
            text.each(function() {
                var text = d3.select(this),
                    words = text.text().split(/\s+/).reverse(),
                    word,
                    line = [],
                    lineNumber = 0,
                    lineHeight = 1.1, // ems
                    y = text.attr("y"),
                    dy = parseFloat(text.attr("dy")),
                    tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > width) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                    }
                }
            });
        }

    }

}]);

