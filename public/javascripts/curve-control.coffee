module.controller "curveController",
  ['$scope', '$cookieStore', 'curveService',
    ($scope, $cookieStore, curveService) ->
      uname = $cookieStore.get("sybase-username")
      pwd = $cookieStore.get("sybase-password")

      uname = "" if (uname == null)
      pwd = "" if (pwd==null)

      $scope.credentials =
        sybase_username: uname
        sybase_password: pwd

      $scope.crjobs = { }
      $scope.curves = { }
      $scope.cronacle_env = "PRD"
      $scope.sybase_env = "PRD"
      $scope.days_ago = "2"
      $scope.busy = 0
      $scope.dayOfWeek = ""
      $scope.analysis = []
      $scope.afterBankHoliday = false

    console.log "Hello from the Coffee curve controller"

    showSubTree()

    $scope.showStats = (jobName) ->
      console.log "Displaying stats for " + jobName
      s = getJobStats jobName
      console.dir s
      if (s.length > 0)
        plotJobGraph s, jobName
      else
        console.log "Empty stats."

    $scope.getCurves = () ->
      $scope.busy = 1

      $cookieStore.put 'sybase-username', $scope.credentials["sybase_username"]
      $cookieStore.put 'sybase-password', $scope.credentials["sybase_password"]

      curveService.getCurves $scope.credentials["sybase_username"],
        $scope.credentials["sybase_password"],
        $scope.sybase_env,
        (curves) ->
          $scope.busy = 0
          $scope.curves = curves
          drawCurveTree curves.curveHierarchy, 400, 1

    logger = (severity, message) ->
      $scope.analysis.push({sev: severity, msg: message})
      console.log(severity + ": " + message)

    shuffle = (myArray) ->
      currentIndex = myArray.length

      # While there remain elements to shuffle...
      while (0 != currentIndex)
        # Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex -= 1

        # And swap it with the current element.
        temporaryValue = myArray[currentIndex]
        myArray[currentIndex] = myArray[randomIndex]
        myArray[randomIndex] = temporaryValue
      return myArray

    # The hierarchy may consist of many hierarchies,
    # i.e. there are multiple root entries.
    # Add an artifical root element to rule them all.
    addMasterRoot = (hierarchy) ->
      h = hierarchy
      # Find the elements without a parent
      hasParent = {}
      rootNodes = {}
      h.forEach( (node) ->
        hasParent[node.childCurve] = true
      )
      h.forEach( (node) ->
        if (!hasParent[node.parentCurve])
          rootNodes[node.parentCurve] = true
      )
      for k in rootNodes
        h.unshift({"parentCurve":"ROOT", "childCurve":k})
      h.unshift({"childCurve":"ROOT"})

    drawCurveTree = (hierarchy, spacing, compressFactor)->
      $("#hive-path").empty()
      addMasterRoot hierarchy

      # Create a map of children for each parent
      children = hierarchy.reduce( (map, node)->
          (map[node.parentCurve] || (map[node.parentCurve] = [])).push(node.childCurve)
          return map
        , {})

      treeData = []

      # Construct starting point
      n = {"nodeName": "ROOT"}

      treeData.push n
      processNode n, 0

      processNode = (node, level)->
        if (level > 30)
          return # Abort on circular references
        if (children[node.nodeName])
          children[node.nodeName].forEach( (kidName)->
            newNode = {"nodeName": kidName}
            treeData.push newNode
            (node.children || (node.children = []))
              .push(newNode)
            processNode newNode, level + 1
          )

      drawTree treeData, spacing, compressFactor

  # Draws a tree
  drawTree = (treeData, spacing, compressFactor)->
    counts = { "Floor-Curve": 1, \
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
      "IR-World-Interbank-FlexAdd-London": 1 }

    if (!spacing)
      spacing = 400
    if (!compressFactor)
      compressFactor = 1

    margin = {top: 50, right: 120, bottom: 20, left: 120}
    width = 3500 - margin.right - margin.left
    height = 1500 - margin.top - margin.bottom

    i = 0;

    tree = d3.layout.tree()
      .size([height, width])

    diagonal = d3.svg.diagonal()
      .projection( (d)-> return [d.y, d.x] )

    svg = d3.select("#hive-path").append("svg")
      .attr("width", width + margin.right + margin.left)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

    root = treeData[0]

    update root

    collapse = (d)->
      if (d.children)
        d._children = d.children
        d._children.forEach(collapse)
        d.children = null

    # Toggle children on click.
    click = (d)->
      logger "INFO", "Clicked on node"
      $("#hive-path").empty()
      svg = d3.select("#hive-path").append("svg")
        .attr("width", width + margin.right + margin.left)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

      if (d.children)
        d._children = d.children
        d.children = null
      else
        d.children = d._children
        d._children = null
      update d

    update = (source)->
      # Compute the new tree layout.
      nodes = tree.nodes(root).reverse()
      links = tree.links(nodes)

      # Normalize for fixed-depth.
      nodes.forEach( (d)-> d.y = d.depth * spacing; d.x = d.x * compressFactor )

      # Declare the nodes
      node = svg.selectAll("g.node")
        .data(nodes, (d)-> return d.id || (d.id = ++i) )

      # Enter the nodes.
      ar nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .on("click", click)
        .attr("transform", (d)->
          return "translate(" + d.y + "," + d.x + ")" )

      nodeEnter.append("circle")
        .attr("r", 10)
        .style("fill", (d)-> return (d._children == null) ? "rgb(255,255,150)" : "rgb(0,0,100)" )

      nodeEnter.append("text")
      .attr("x", (d)->
        l = d.nodeName.length * 6
        return d.children || d._children ? 0 : 0 )
      .attr("dy", "-13px")
      .attr("text-anchor", (d)->
        return d.children || d._children ? "end" : "start" )
      .text((d)-> return d.nodeName +
          ( ( typeof (counts[d.nodeName]) == "undefined" ) ?
          '' : ' (' + counts[d.nodeName] + ')') )
      .style("fill", "#004488")

      # Declare the links
      link = svg.selectAll("path.link")
        .data(links, (d)-> return d.target.id )

      # Enter the links.
      link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("d", diagonal)


]

