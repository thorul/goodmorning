/**
 * Created by thorul on 30/03/2015.
 */

module.controller("curveController", ['$scope', '$cookieStore', 'curveService', function($scope, $cookieStore, curveService) {

    var uname = $cookieStore.get("sybase-username");
    var pwd = $cookieStore.get("sybase-password");

    if (uname == null)
        uname = "";
    if (pwd == null)
        pwd = "";

    $scope.credentials = {
        sybase_username: uname,
        sybase_password: pwd
    };

    $scope.crjobs = { };
    $scope.curves = { };
    $scope.cronacle_env = "PRD";
    $scope.sybase_env = "PRD";
    $scope.days_ago = "2";
    $scope.busy = 0;
    $scope.dayOfWeek = "";
    $scope.analysis = [];
    $scope.afterBankHoliday = false;
    $scope.curveJson = "E.g. EXECUTE RiskMGTOutSys4..ListCurveDepends 'IR-US-USD-Government-London', @InATree='Y';";

    console.log("Hello from the curve controller");

    showSubTree();

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

    $scope.getCurves = function() {
        $scope.busy = 1;

        $cookieStore.put('sybase-username', $scope.credentials["sybase_username"]);
        $cookieStore.put('sybase-password', $scope.credentials["sybase_password"]);

        curveService.getCurves( $scope.credentials["sybase_username"],
            $scope.credentials["sybase_password"], $scope.sybase_env,
            function(curves) {
                $scope.busy = 0;
                $scope.curves = curves;
                drawCurveTree(curves.curveHierarchy, 400, 1);
            });
    };

    var logger = function(severity, message) {
        $scope.analysis.push({sev: severity, msg: message});
        console.log(severity + ": " + message);
    };

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

    // The hierarchy may consist of many hierarchies,
    // i.e. there are multiple root entries.
    // Add an artifical root element to rule them all.
    function addMasterRoot(hierarchy) {
        // var h = $scope.curves["curveHierarchy"];
        var h = hierarchy;
        // Find the elements without a parent
        var hasParent = {};
        var rootNodes = {};
        h.forEach(function(node) {
            hasParent[node.childCurve] = true;
        })
        h.forEach(function(node) {
            if (!hasParent[node.parentCurve]) {
                rootNodes[node.parentCurve] = true;
            }
        })
        for (var k in rootNodes) {
            h.unshift({"parentCurve":"ROOT", "childCurve":k});
        }
        h.unshift({"childCurve":"ROOT"});
    }

    function drawCurveTree(hierarchy, spacing, compressFactor) {

        $("#hive-path").empty();
        addMasterRoot(hierarchy);

        // Create a map of children for each parent
        var children = hierarchy.reduce(function (map, node) {
            (map[node.parentCurve] || (map[node.parentCurve] = []))
                .push(node.childCurve);
            return map;
        }, {});

        var treeData = [];

        // Construct starting point
        var n = {"nodeName": "ROOT"};

        treeData.push(n);
        processNode(n, 0);

        function processNode(node, level) {
            if (level > 30)
                return; // Abort on circular references
            if (children[node.nodeName]) {
                children[node.nodeName].forEach(function (kidName) {
                    var newNode = {"nodeName": kidName};
                    treeData.push(newNode);
                    (node.children || (node.children = []))
                        .push(newNode);
                    processNode(newNode, level + 1);
                });
            }
        }

        drawTree(treeData, spacing, compressFactor);

        /*
         // Unit test
         treeData = [];
         var n1 = { "curveName": "A", "children": []};
         treeData.push(n1);
         var n2 = { "curveName": "B", "children": []};
         treeData.push(n2);
         var n3 = { "curveName": "C", "children": []};
         treeData.push(n3);
         var n4 = { "curveName": "D", "children": []};
         treeData.push(n4);
         var n5 = { "curveName": "E", "children": []};
         treeData.push(n5);
         var n6 = { "curveName": "E", "children": []};
         treeData.push(n6);
         n1.children.push(n2);
         n1.children.push(n3);
         n3.children.push(n4);
         n3.children.push(n5);
         n2.children.push(n6);
         */

    }

    // Draws a tree
    function drawTree(treeData, spacing, compressFactor) {
        var counts = { "Floor-Curve": 1,
            "IR-<Currency>-Government-Base-London": 31,
            "IR-<Currency>-Government-London": 31,
            "IR-<Currency>-Interbank-Base-London": 31,
            "IR-<Currency>-Interbank-Floor-London": 33,
            "IR-<Currency>-Interbank-London": 31,
            "IR-<Currency>-USD-CcySwap-Base-London": 24,
            "IR-<Currency>-USD-CcySwap-Int2-London": 24,
            "IR-<Currency>-USD-CcySwap-London": 24,
            "IR-<Region>-Corp-FlexAdd-London": 11,
            "IR-<Region>-Corp-FlexMult-London": 11,
            "IR-<Region>-Government-FlexAdd-London": 10,
            "IR-<Region>-Interbank-FlexAdd-London": 10,
            "IR-CcySwap-FlexMult-London": 1,
            "IR-World-Corp-FlexAdd-London": 1,
            "IR-World-Corp-FlexMult-London": 1,
            "IR-World-Government-FlexAdd-London": 1,
            "IR-World-Interbank-FlexAdd-London": 1 };

        if (!spacing)
            spacing = 400;
        if (!compressFactor)
            compressFactor = 1;

        var margin = {top: 50, right: 120, bottom: 20, left: 120},
            width = 3500 - margin.right - margin.left,
            height = 1500 - margin.top - margin.bottom;

        var i = 0;

        var tree = d3.layout.tree()
            .size([height, width]);

        var diagonal = d3.svg.diagonal()
            .projection(function(d) { return [d.y, d.x]; });

        var svg = d3.select("#hive-path").append("svg")
            .attr("width", width + margin.right + margin.left)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        root = treeData[0];

        update(root);

        function collapse(d) {
            if (d.children) {
                d._children = d.children;
                d._children.forEach(collapse);
                d.children = null;
            }
        }

        // Toggle children on click.
        function click(d) {
            logger("INFO", "Clicked on node");
            $("#hive-path").empty();
            svg = d3.select("#hive-path").append("svg")
                .attr("width", width + margin.right + margin.left)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            update(d);
        }

        function update(source) {

            // Compute the new tree layout.
            var nodes = tree.nodes(root).reverse();
            var links = tree.links(nodes);

            // Normalize for fixed-depth.
            nodes.forEach(function(d) { d.y = d.depth * spacing; d.x = d.x * compressFactor; });

            // Declare the nodes
            var node = svg.selectAll("g.node")
                .data(nodes, function(d) { return d.id || (d.id = ++i); });

            // Enter the nodes.
            var nodeEnter = node.enter().append("g")
                .attr("class", "node")
                .on("click", click)
                .attr("transform", function(d) {
                    return "translate(" + d.y + "," + d.x + ")"; });

            nodeEnter.append("circle")
                .attr("r", 10)
                .style("fill", function(d) { return (d._children == null) ? "rgb(255,255,150)" : "rgb(0,0,100)"; } );

            nodeEnter.append("text")
                .attr("x", function(d) {
                    var l = d.nodeName.length * 6;
                    return d.children || d._children ? 0 : 0; })
                .attr("dy", "-13px")
                .attr("text-anchor", function(d) {
                    return d.children || d._children ? "end" : "start"; })
                .text(function(d) { return d.nodeName +
                    ( ( typeof (counts[d.nodeName]) == "undefined" ) ?
                    '' : ' (' + counts[d.nodeName] + ')'); })
                .style("fill", "#004488");

            // Declare the links
            var link = svg.selectAll("path.link")
                .data(links, function(d) { return d.target.id; });

            // Enter the links.
            link.enter().insert("path", "g")
                .attr("class", "link")
                .attr("d", diagonal);
        }

    }

    function showCurves(hierarchy) {
        $("#hive-path").empty();

        var graph = {
            "nodes":[],
            "links":[]
        };
        var nodeMap = {};
        var i = 0;

        $scope.curves["curves"].forEach(function(node) {
            gid = 1;
            if (node.curveId == 0)
                gid = 2;
            graph.nodes.push({"name": node.curveName, "group": gid});
            nodeMap[ node.curveName ] = i;
            i++;
        });

        $scope.curves["curveHierarchy"].forEach(function(node) {
            if (node.parentCurve)
                graph["links"].push({
                    "source": nodeMap[node.parentCurve],
                    "target": nodeMap[node.childCurve],
                    "value": 2,
                    "weight": node.group
                });
            else {
                console.log("Skipping: ");
                console.dir(node);
            }
        });

        console.dir(graph);
        drawNodeStats(graph);

         // d3.json("../json/traffic_data.json", function(error, graph) {
    }

    // D3 Graphics - draws a force graph
    function drawNodeStats(graph) {
        var width = 800,
            height = 500;

        var color = d3.scale.category20();

        var force = d3.layout.force()
            .linkDistance(20)
            .linkStrength(5)
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
            .attr("r", 10)
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

    // Investigates output from ListCurveDepends stored procedure.
    function showSubTree() {
        var hierarchy = [
            {"parentCurve": "IR-<Currency>-Interbank-Floor-London", "childCurve": "Floor-Curve"},
            {"parentCurve": "IR-<Currency>-Interbank-Floor-London", "childCurve": "IR-<Currency>-Interbank-London"},
            {"parentCurve": "IR-<Currency>-Interbank-London", "childCurve": "IR-<Currency>-Interbank-Base-London"},
            {"parentCurve": "IR-<Currency>-Interbank-London", "childCurve": "IR-<Region>-Interbank-FlexAdd-London"}
        ];

        drawCurveTree(hierarchy, 300, 0.25);
    }

    // Investigates output from ListCurveDepends stored procedure.
    $scope.showCustomSubTree = function() {
        var s = $scope.curveJson.replace(/,$/g, "");
        s = s.replace(/,$/g, "");
        s = s.replace(/$/g, "");
        try {
            var hierarchy = JSON.parse("[" + s + "]");
        } catch (e) {
            console.log("Failed to parse JSON: " + s);
            alert("Incorrect JSON")
            return;
        }
        console.log(hierarchy);
        drawCurveTree(hierarchy, 300, 0.25);
    }

    // Investigates output from ListCurveDepends stored procedure.
    $scope.showCustomGraph = function() {
        var graph = {
            "nodes":[],
            "links":[]
        };
        var hierarchy = {};

        var s = $scope.curveJson.replace(/,$/g, "");
        s = s.replace(/,$/g, "");
        s = s.replace(/$/g, "");
        try {
            hierarchy = JSON.parse("[" + s + "]");
        } catch (e) {
            console.log("Failed to parse JSON: " + s);
            alert("Incorrect JSON")
            return;
        }

        var inx=0;
        var nodeMap = hierarchy.reduce(function(map, rel) {
            if (typeof (map[rel.parentCurve]) == "undefined") {
                var newNode = {"name": rel.parentCurve, "group": rel.level};
                graph.nodes.push(newNode);
                map[rel.parentCurve] = inx;
                inx+=1;
            }
            if (typeof (map[rel.childCurve]) == "undefined") {
                var newNode = {"name": rel.childCurve, "group": rel.level};
                graph.nodes.push(newNode);
                map[rel.childCurve] = inx;
                inx+=1;
            }
            return map;
        }, {});

        // Build links
        hierarchy.forEach(function(rel) {
            if (rel.parentCurve)
                graph["links"].push({
                    "source": nodeMap[rel.parentCurve],
                    "target": nodeMap[rel.childCurve],
                    "value": 2,
                    "weight": parseInt(rel.level)
                });
        });

        drawNodeStats(graph);
    }


    function getNodeData() {
        var graph = {
            "nodes":[],
            "links":[]
        };

        var myGroup = [];
        var groups = [];

        var links = [
            {'source': 'IR-CAD-Interbank-Floor-London', 'target': 'Floor-Curve', 'group': '4'},
            {'source': 'IR-CAD-Interbank-Floor-London', 'target': 'IR-CAD-Interbank-London', 'group': '4'},
            {'source': 'IR-CAD-Interbank-London', 'target': 'IR-CAD-Interbank-Base-London', 'group': '3'},
            {'source': 'IR-CAD-Interbank-London', 'target': 'IR-North America-Interbank-FlexAdd-London', 'group': '3'},
            {'source': 'IR-CAD-USD-CcySwap-Int1-London', 'target': 'IR-CAD-USD-CcySwap-Base-London', 'group': '7'},
            {'source': 'IR-CAD-USD-CcySwap-Int1-London', 'target': 'IR-CcySwap-FlexMult-London', 'group': '7'},
            {'source': 'IR-CAD-USD-CcySwap-Int2-London', 'target': 'IR-CAD-USD-CcySwap-Int1-London', 'group': '6'},
            {'source': 'IR-CAD-USD-CcySwap-Int2-London', 'target': 'IR-CcySwap-FlexAdd-London', 'group': '6'},
            {'source': 'IR-CAD-USD-CcySwap-London', 'target': 'IR-CAD-Interbank-Floor-London', 'group': '5'},
            {'source': 'IR-CAD-USD-CcySwap-London', 'target': 'IR-CAD-USD-CcySwap-Int2-London', 'group': '5'},
            {'source': 'IR-North America-Interbank-FlexAdd-London', 'target': 'IR-World-Interbank-FlexAdd-London', 'group': '2'},
            {'source': 'IR-USD-Interbank-Floor-London', 'target': 'Floor-Curve', 'group': '1'},
            {'source': 'IR-USD-Interbank-Floor-London', 'target': 'IR-USD-Interbank-London', 'group': '1'},
            {'source': 'IR-USD-Interbank-London', 'target': 'IR-North America-Interbank-FlexAdd-London', 'group': '1'},
            {'source': 'IR-USD-Interbank-London', 'target': 'IR-USD-Interbank-Base-London', 'group': '0'}
        ];

        // Create nodes
        var inx = 0;
        var nodeMap = links.reduce(function(map, link) {
            if (typeof (map[link.source]) == "undefined") {
                var newNode = {"name": link.source, "group": link.group};
                graph.nodes.push(newNode);
                map[link.source] = inx;
                inx+=1;
            }
            if (typeof (map[link.target]) == "undefined") {
                var newNode = {"name": link.target, "group": link.group};
                graph.nodes.push(newNode);
                map[link.target] = inx;
                inx+=1;
            }
            return map;
        }, {});

        // Create links
        links.forEach(function(link) {
           graph.links.push({ "source": nodeMap[link.source],
               "target": nodeMap[link.target],
                "value": link.group });
        });

        console.dir(graph);
        drawNodeStats(graph);

        // d3.json("../json/traffic_data.json", function(error, graph) {
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

        var ww = $(window).width() - 200;
        var hh = $(window).height() - 100;

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
        var header = ["Elapsed mins"];
        var xAxisValues = [];
        var tstamps = [];
        var ts_last = 0;

        // Initialise dataSet with an empty array
        dataSet.push([]);

        var sample = 0,
            margin = {top: 5, right: 100, bottom: 30, left: 50},
            w = $("#graph").width() - margin.left - margin.right - 20,
            h = $("#graph").height() - margin.top - margin.bottom - 20;

        d3.select("#TheGraph").remove();

        var max1 = 0, min1, ts_first, ts_last;
        for (var pt = 0; pt < data.length; pt++) {
            if (true) {
                tstamps.push(data[pt].start);
                var tstamp = data[pt].start;
                if (ts_first == undefined) {
                    ts_first = tstamp;
                    ts_last = tstamp;
                }
                if (tstamp > ts_last) ts_last = tstamp;
                var minCandidate = parseInt(data[pt].elapsed);
                var maxCandidate = parseInt(data[pt].elapsed);

                // Fix max and min values
                if (min1 == undefined) {
                    min1 = minCandidate;
                }
                if (minCandidate < min1) {
                    min1 = minCandidate;
                }
                if (maxCandidate > max1) max1 = maxCandidate;

                ts_last = data[pt].start;

                console.log("Pushing " + ts_last + ", min1=" + min1 + ", max1=" + max1);
                // dataSet[0].push({x:ts_last, y:data[pt].jobElapsed});
                dataSet[0].push({x: data[pt].start, y: data[pt].elapsed});
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
            .domain([min1, max1 * 1.05])
            .range([h + margin.top, margin.top]);

        console.log("tstamps = " + tstamps + ", margin.left/w=" + margin.left + "/" + w);

        var xScale = d3.scale.ordinal()
            .domain(tstamps)
            //.rangeRoundBands([0, w+margin.left+margin.right], 1);
            .rangeBands([0 + margin.left, w + margin.left], 1, 0.1);
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
            .x(function (d, i) {
                // verbose logging to show what's actually being done
                // console.log('Plotting X1 value for data point: ' + d.x + ' using index: ' + i + '/' + sample + ' to be at: ' + xScale(d.x) + ' using our xScale.');
                // return the X coordinate where we want to plot this datapoint
                return xScale(d.x);
            })
            .y(function (d) {
                // verbose logging to show what's actually being done
                // console.log('Plotting Y1 value for data point: ' + d.y + ' to be at: ' + y1(d.y) + "/" + h + "/" + max1 + " using our y1 scale.");
                // return the Y coordinate where we want to plot this datapoint
                return y1(d.y);
            });

        // create an area function that can convert data[] into x and y points
        var area1 = d3.svg.area()
            // .interpolate("basis")
            // assign the X function to plot our line as we wish
            .x(function (d, i) {
                // verbose logging to show what's actually being done
                // console.log('Plotting X1 value for data point: ' + d.x + ' using index: ' + i + '/' + sample + ' to be at: ' + xScale(d.x) + ' using our xScale.');
                // return the X coordinate where we want to plot this datapoint
                return xScale(d.x);
            })
            .y0(h + margin.top)
            .y1(function (d) {
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
            .tickSize(h - margin.top, 0)
            .tickFormat(function (d) {
                return d;
            })
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
                .tickSize(-w, 0, 0)
                .tickFormat(d3.format("0f"))
        );

        // Draw the lines
        for (var gn = 0; gn < dataSet.length; gn++) {
            // for (var gn=3; gn<4; gn++) {
            // graph.append("svg:path").attr("d", area1(dataSet[gn])).classed("data1 area", "true");
            var l = graph.append("svg:path")
                .attr("d", (gn == 0) ? area1(dataSet[gn]) : line1(dataSet[gn]))
                .attr("stroke", colors[gn])
                .style("fill", (gn == 0) ? colors[gn] : "none")
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
            .attr("x", margin.right + w - 40)
            .attr("y", function (d, i) {
                return i * 20 + 9;
            })
            .attr("width", 10)
            .attr("height", 10)
            .style("fill", function (d) {
                var color = colors[dataSet.indexOf(d)];
                return color;
            })

        legend.selectAll('text')
            .data(dataSet)
            .enter()
            .append("text")
            .attr("class", "legend-text")
            .attr("x", margin.right + w - 20)
            .attr("y", function (d, i) {
                return i * 20 + 19;
            })
            .style("fill", "white")
            .text(function (d) {
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
            text.each(function () {
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

