/**
 * Created by thorul on 30/03/2015.
 */

module.controller("bstatsController", ['$scope', '$cookieStore', 'bstatsService', function($scope, $cookieStore, bstatsService) {

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
    $scope.sybase_env = "DEV";
    $scope.days_ago = "14";
    $scope.busy = 0;
    $scope.dayOfWeek = "";
    $scope.analysis = [];
    $scope.runTimes = [];

    console.log("Hello from the bstats controller");

    // For a given job get the list of runs:
    var getJobStats = function(jobName) {
        var retVal = [];
        // Find the first job that matches jobName
        $scope.stats.some(function(jobRuns) {
            if (jobRuns["op"] == jobName)
                retVal = jobRuns["runs"];
            return jobRuns["op"] == jobName;
        });
        return retVal;
    }

    $scope.showStats = function(jobName) {
        console.log("Displaying stats for " + jobName);
        var s = getJobStats(jobName); // Fetch the run times.
        console.dir(s);
        if (s.length > 0) {
            plotJobGraph(s, jobName);
        }
        else { console.log("Empty stats."); }
    };

    $scope.getStats = function() {
        $scope.busy = 1;

        $cookieStore.put('sybase-username', $scope.credentials["sybase_username"]);
        $cookieStore.put('sybase-password', $scope.credentials["sybase_password"]);

        bstatsService.getStats( $scope.credentials["sybase_username"],
            $scope.credentials["sybase_password"], $scope.sybase_env, $scope.days_ago,
            function(stats) {
                $scope.busy = 0;
                $scope.stats = [];

                var smap = stats["jobStats"].reduce(function(map, aRun) {
                    if (!map[aRun.op]) {
                        var newOp = { "op": aRun.op, "runs": [], "revruns": []};
                        $scope.stats.push(newOp);
                        map[aRun.op] = newOp;
                    }
                    var trend = "NO-INCREASE";
                    var lastVal = parseInt(aRun.elapsed);
                    if (map[aRun.op].runs.length > 0)
                        lastVal = parseInt(map[aRun.op].runs[ map[aRun.op].runs.length-1].elapsed );
                    if (lastVal < parseInt(aRun.elapsed))
                        trend = "INCREASE";
                    map[aRun.op].runs.push({"elapsed": aRun.elapsed, "start": aRun.start, "trend": trend});
                    map[aRun.op].revruns.unshift({"elapsed": aRun.elapsed, "start": aRun.start, "trend": trend});
                    return map;
                }, {});
                //drawCurveTree();
            });
    };

    var logger = function(severity, message) {
        $scope.analysis.push({sev: severity, msg: message});
        console.log(severity + ": " + message);
    };

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
      var header = [ "Elapsed secs" ];
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
          tstamps.push(data[pt].start);
          var tstamp = data[pt].start;
          if (ts_first == undefined) { ts_first = tstamp; ts_last = tstamp; }
          if (tstamp > ts_last) ts_last = tstamp;
          var minCandidate = parseInt(data[pt].elapsed);
          var maxCandidate = parseInt (data[pt].elapsed);

          // Fix max and min values
          if (min1 == undefined) { min1 =  minCandidate; }
          if (minCandidate < min1) { min1 = minCandidate; }
          if (maxCandidate > max1) max1 = maxCandidate;

          ts_last = data[pt].start;

          console.log("Pushing " + ts_last + ", min1=" + min1 + ", max1=" + max1);
          // dataSet[0].push({x:ts_last, y:data[pt].jobElapsed});
          dataSet[0].push({x:data[pt].start, y:data[pt].elapsed});
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
      var marg = ( max1 - min1 ) / 10;
      var y1 = d3.scale.linear()
          .domain([min1-marg, max1+marg])
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

