define(['d3', '../../hierarchyelements', '../../datastore', '../../listeners', './settings', '../../config', '../../uiutil'],
    function (d3, hierarchyElements, dataStore, listeners, s, config, uiUtil) {

        var BOX_WIDTH = 10;
        var DATA_AXIS_WIDTH = 16;
        var DATA_GROUP_V_PADDING = 4;
        var DATA_AXIS_SIZE = 60;

        var hDatasetGroupRenderer = new HDataRenderer();
        var vDatasetGroupRenderer = new VDataRenderer();
        var currentDatasetGroupRenderer = hDatasetGroupRenderer;


        function DatasetWrapper(dataset) {
            hierarchyElements.HierarchyElement.call(this);
            this.collapsed = true;
            this.dataset = dataset;
            this.name = dataset.info.name;
            this.id = dataset.info.id;
            this.color = dataset.info.color;
            this.type = dataset.info.type;
            if (this.type === "matrix") {
                this.minValue = dataset.stats.min;
                this.maxValue = dataset.stats.max;
            }
        }

        DatasetWrapper.prototype = Object.create(hierarchyElements.HierarchyElement.prototype);

        DatasetWrapper.prototype.getBaseHeight = function () {
            return s.isTiltAttributes() ? DATA_AXIS_SIZE + 2 * DATA_GROUP_V_PADDING : BOX_WIDTH + 2 * DATA_GROUP_V_PADDING;
        };

        DatasetWrapper.prototype.getHeight = function () {
            var h = hierarchyElements.HierarchyElement.prototype.getHeight.call(this);
            return (!s.isTiltAttributes() && !this.collapsed) ? h + DATA_AXIS_WIDTH : h;
        };

        DatasetWrapper.prototype.renderEnter = function (parent, pathWrapper, pathList) {
            var that = this;
            parent.append("text")
                .classed("collapseIconSmall", true)
                .attr({
                    x: 5,
                    y: (that.getBaseHeight() - 10) / 2 + 9
                });
            var datasetLabel = parent.append("text")
                .attr({
                    x: s.SET_TYPE_INDENT,
                    y: (that.getBaseHeight() - 10) / 2 + 9,
                    "clip-path": "url(#SetLabelClipPath)"
                })
                .style({
                    fill: this.color
                })
                .text(function (d) {
                    return d.name;
                });

            datasetLabel.append("title")
                .text(function (d) {
                    return d.name;
                });

            currentDatasetGroupRenderer.onDatasetEnter(parent, pathWrapper, this, pathList);
        };

        DatasetWrapper.prototype.renderUpdate = function (parent, pathWrapper, pathList) {
            var that = this;

            parent.select("text.collapseIconSmall")
                .text(function (d) {
                    return d.collapsed ? "\uf0da" : "\uf0dd";
                })
                .on("click", function (d) {
                    var collapsed = !d.collapsed;
                    if (d3.event.ctrlKey) {
                        listeners.notify(s.pathListUpdateTypes.COLLAPSE_ELEMENT_TYPE, {
                            type: d.name,
                            collapsed: collapsed
                        });
                    } else {
                        d.collapsed = collapsed;
                        d3.select(this).text(d.collapsed ? "\uf0da" : "\uf0dd");

                        pathList.updatePathList();

                    }
                });


            currentDatasetGroupRenderer.onDatasetUpdate(parent, pathWrapper, this, pathList);


            var allChildren = parent.selectAll("g.dataGroup")
                .data(that.getVisibleChildren(), function (d) {
                    return d.name
                });

            var child = allChildren.enter()
                .append("g")
                .classed("dataGroup", true);

            child.each(function (child) {
                child.renderEnter(d3.select(this), pathWrapper, that, pathList);
            });

            allChildren.attr({
                transform: function (d, i) {
                    var posY = that.getBaseHeight();
                    var groups = that.getVisibleChildren();

                    for (var j = 0; j < i; j++) {
                        var g = groups[j];
                        posY += g.getHeight();
                    }
                    return ("translate(0, " + posY + ")");
                }
            });


            allChildren.each(function (child) {
                child.renderUpdate(d3.select(this), pathWrapper, that, pathList);
            });

            allChildren.exit().remove();
        };


        function DataGroupWrapper(name, parent) {
            hierarchyElements.HierarchyElement.call(this, parent);
            this.name = name;
        }

        DataGroupWrapper.prototype = Object.create(hierarchyElements.HierarchyElement.prototype);

        DataGroupWrapper.prototype.getBaseHeight = function () {
            return s.isTiltAttributes() ? DATA_AXIS_SIZE + 2 * DATA_GROUP_V_PADDING : BOX_WIDTH + 2 * DATA_GROUP_V_PADDING;
        };

        DataGroupWrapper.prototype.isSticky = function () {
            return s.isDataGroupSticky(this.parent.id, this.name);
        };

        DataGroupWrapper.prototype.renderEnter = function (parent, pathWrapper, dataset, pathList) {
            var that = this;

            parent.append("rect")
                .classed("background", true)
                .attr({
                    x: s.SET_TYPE_INDENT,
                    y: DATA_GROUP_V_PADDING,
                    width: pathList.getNodePositionX(pathWrapper, pathWrapper.path.nodes.length - 1, false) + s.NODE_WIDTH + (s.isTiltAttributes() ? 0 : s.EDGE_SIZE / 2),
                    height: s.isTiltAttributes() ? DATA_AXIS_SIZE : BOX_WIDTH
                })
                .style({
                    //stroke: "black",
                    fill: "rgba(240,240,240,0.5)"
                });

            var groupLabel = parent.append("text")
                .attr({
                    x: s.SET_TYPE_INDENT,
                    y: (that.getBaseHeight() - 10) / 2 + 9,
                    "clip-path": "url(#SetLabelClipPath)"
                })
                .style({
                    fill: dataset.color
                })
                .text(function (d) {
                    return d.name;
                });

            groupLabel.append("title")
                .text(function (d) {
                    return d.name;
                });

            currentDatasetGroupRenderer.onDataGroupEnter(parent, pathWrapper, dataset, that, pathList);
        };

        DataGroupWrapper.prototype.renderUpdate = function (parent, pathWrapper, dataset, pathList) {
            var that = this;

            parent.select("rect.background")
                .transition()
                .attr({
                    width: pathList.getNodePositionX(pathWrapper, pathWrapper.path.nodes.length - 1, false) + s.NODE_WIDTH + (s.isTiltAttributes() ? 0 : s.EDGE_SIZE / 2),
                    height: s.isTiltAttributes() ? DATA_AXIS_SIZE : BOX_WIDTH
                });


            currentDatasetGroupRenderer.onDataGroupUpdate(parent, pathWrapper, dataset, this, pathList);

            var statData = [];

            pathWrapper.path.nodes.forEach(function (node, index) {
                var stats = dataStore.getStatsForNode(node, dataset.id, that.name);
                if (typeof stats !== "undefined") {
                    statData.push({
                        stats: stats,
                        node: node,
                        nodeIndex: index
                    });
                }
            });

            var allNodeData = parent.selectAll("g.nodeData")
                .data(statData, function (d) {
                    return d.node.id;
                });


            var nodeData = allNodeData.enter()
                .append("g")
                .classed("nodeData", true);

            nodeData.each(function (statData) {
                currentDatasetGroupRenderer.onNodeDataEnter(d3.select(this), pathWrapper, dataset, that, statData, pathList);
            });

            allNodeData.each(function (statData) {
                currentDatasetGroupRenderer.onNodeDataUpdate(d3.select(this), pathWrapper, dataset, that, statData, pathList);
            });

            allNodeData.exit().remove();

        };


        //function DataRenderer(pathList) {
        //    this.pathList = pathList;
        //}
        //
        //DataRenderer.prototype = {
        //
        //    render: function () {
        //
        //    },
        //
        //    onDatasetEnter: function ($dataset, pathWrapper, dataset, datasetIndex) {
        //
        //    }
        //    ,
        //
        //    onDatasetUpdate: function ($dataset, pathWrapper, dataset, datasetIndex) {
        //
        //    }
        //    ,
        //
        //    onDataGroupEnter: function ($group, pathWrapper, dataset, group, groupIndex) {
        //
        //    }
        //    ,
        //
        //    onDataGroupUpdate: function ($group, pathWrapper, dataset, group, groupIndex) {
        //
        //    }
        //    ,
        //
        //    onNodeDataEnter: function ($nodeData, pathWrapper, dataset, group, statData) {
        //
        //    }
        //    ,
        //
        //    onNodeDataUpdate: function ($nodeData, pathWrapper, dataset, group, statData) {
        //
        //    }
        //
        //}
        //;

        function HDataRenderer(pathList) {
        }

        HDataRenderer.prototype.onDatasetEnter = function ($dataset, pathWrapper, dataset, pathList) {

            var axisSize = config.getNodeWidth() + s.EDGE_SIZE / 2;
            var scaleX = d3.scale.linear().domain([dataset.minValue, dataset.maxValue]).range([0, axisSize]);

            this.appendAxes($dataset, pathWrapper, dataset, pathList);

        };

        HDataRenderer.prototype.appendAxes = function ($dataset, pathWrapper, dataset, pathList) {
            var that = this;
            var axisSize = config.getNodeWidth() + s.EDGE_SIZE / 2;
            var scaleX = d3.scale.linear().domain([dataset.minValue, dataset.maxValue]).range([0, axisSize]);

            var xAxis = d3.svg.axis()
                .scale(scaleX)
                .orient("bottom")
                .tickValues([dataset.minValue, dataset.maxValue - (Math.abs(dataset.maxValue - dataset.minValue) / 2), dataset.maxValue])
                //.tickFormat(d3.format(".2f"))
                .tickSize(3, 3);

            var allAxes = $dataset.selectAll("g.boxPlotAxisX")
                .data(pathWrapper.path.nodes);

            allAxes.enter()
                .append("g")
                .classed("boxPlotAxisX", true)
                .attr({
                    transform: function (d, i) {
                        return "translate(" + (pathList.getNodePositionX(pathWrapper, i, true) - axisSize / 2) + "," + (dataset.getHeight() - DATA_AXIS_WIDTH) + ")";
                    }
                })
                .call(xAxis);
        };

        HDataRenderer.prototype.onDatasetUpdate = function ($dataset, pathWrapper, dataset, pathList) {

            $dataset.selectAll("g.boxPlotAxisY").remove();

            var that = this;
            var axisSize = config.getNodeWidth() + s.EDGE_SIZE / 2;
            var scaleX = d3.scale.linear().domain([dataset.minValue, dataset.maxValue]).range([0, axisSize]);
            var allAxes = $dataset.selectAll("g.boxPlotAxisX")
                .data(pathWrapper.path.nodes);

            if (dataset.collapsed) {
                allAxes.remove();
            } else {
                this.appendAxes($dataset, pathWrapper, dataset, pathList);
                allAxes.transition()
                    .attr({
                        transform: function (d, i) {
                            return "translate(" + (pathList.getNodePositionX(pathWrapper, i, true) - axisSize / 2) + "," + (dataset.getHeight() - DATA_AXIS_WIDTH) + ")"
                        }
                    });

                allAxes.exit().remove();
            }

            var statData = [];

            pathWrapper.path.nodes.forEach(function (node, index) {
                if (dataset.children.length > 0) {
                    var stats = dataStore.getStatsForNode(node, dataset.id);
                    if (typeof stats !== "undefined") {
                        statData.push({
                            stats: stats,
                            node: node,
                            nodeIndex: index
                        });
                    }
                }
            });


            var allSummaryPlots = $dataset.selectAll("g.nodeSummaryData")
                .data(statData, function (d) {
                    return d.node.id;
                });

            allSummaryPlots.enter()
                .append("g")
                .classed("nodeSummaryData", true)
                .each(function (statData) {
                    var axisSize = config.getNodeWidth() + s.EDGE_SIZE / 2;
                    var $summaryData = d3.select(this);
                    $summaryData.attr({
                        transform: "translate(" + (pathList.getNodePositionX(pathWrapper, statData.nodeIndex, true) - axisSize / 2) + "," + (DATA_GROUP_V_PADDING) + ")"
                    });

                    appendBoxPlotH($summaryData, statData.stats, scaleX, dataset.color);
                });

            allSummaryPlots
                .each(function (statData) {
                    var axisSize = config.getNodeWidth() + s.EDGE_SIZE / 2;
                    var $summaryData = d3.select(this);
                    $summaryData.transition()
                        .attr({
                            transform: "translate(" + (pathList.getNodePositionX(pathWrapper, statData.nodeIndex, true) - axisSize / 2) + "," + (DATA_GROUP_V_PADDING) + ")"
                        });

                    updateBoxPlotH($summaryData, statData.stats, scaleX);
                });

            allSummaryPlots.exit()
                .remove();

        };

        HDataRenderer.prototype.onDataGroupEnter = function ($group, pathWrapper, dataset) {
        };

        HDataRenderer.prototype.onDataGroupUpdate = function ($group) {
            $group.selectAll("g.boxPlotAxisY").remove();
        };

        HDataRenderer.prototype.onNodeDataEnter = function ($nodeData, pathWrapper, dataset, group, statData, pathList) {
            var that = this;

            var axisSize = config.getNodeWidth() + s.EDGE_SIZE / 2;

            var scaleX = d3.scale.linear().domain([dataset.minValue, dataset.maxValue]).range([0, axisSize]);

            $nodeData.attr({
                transform: "translate(" + (pathList.getNodePositionX(pathWrapper, statData.nodeIndex, true) - axisSize / 2) + "," + DATA_GROUP_V_PADDING + ")"
            });

            //var stats = dataStore.getStatsForNode(node, dataset.name, group.name);

            appendBoxPlotH($nodeData, statData.stats, scaleX, dataset.color);
        };


        HDataRenderer.prototype.onNodeDataUpdate = function ($nodeData, pathWrapper, dataset, group, statData, pathList) {
            var that = this;

            var axisSize = config.getNodeWidth() + s.EDGE_SIZE / 2;
            var scaleX = d3.scale.linear().domain([dataset.minValue, dataset.maxValue]).range([0, axisSize]);

            $nodeData
                .transition()
                .attr({
                    transform: "translate(" + (pathList.getNodePositionX(pathWrapper, statData.nodeIndex, true) - axisSize / 2) + "," + DATA_GROUP_V_PADDING + ")"
                });

            updateBoxPlotH($nodeData, statData.stats, scaleX);

            //var allPoints = $nodeData.selectAll("g.dataPoint")
            //  .data(dataStore.getDataForNode(node, dataset.name, group.name));
            //
            //var point = allPoints.enter()
            //  .append("g")
            //  .classed("dataPoint", true);
            //
            //point.append("circle")
            //  .attr({
            //
            //    cy: BOX_WIDTH / 2,
            //
            //    cx: function (d) {
            //      return scaleX(d);
            //    },
            //    r: 1
            //
            //  })
            //  .style({
            //    opacity: 2,
            //    fill: "red"
            //  });
            //
            //allPoints.selectAll("circle")
            //  .transition()
            //  .attr({
            //    cy: BOX_WIDTH / 2,
            //
            //    cx: function (d) {
            //      return scaleX(d);
            //    }
            //  });
            //
            //allPoints.exit().remove();

        };


        function VDataRenderer(pathList) {
        }

        VDataRenderer.prototype.onDatasetEnter = function ($dataset, pathWrapper, dataset) {
            this.appendAxis($dataset, dataset);
        };

        VDataRenderer.prototype.onDatasetUpdate = function ($dataset, pathWrapper, dataset, pathList) {
            $dataset.selectAll("g.boxPlotAxisX").remove();
            var that = this;

            var scaleY = d3.scale.linear().domain([dataset.minValue, dataset.maxValue]).range([DATA_AXIS_SIZE, 0]);

            if ($dataset.select("g.boxPlotAxisY").empty()) {
                this.appendAxis($dataset, dataset);
            }

            var statData = [];

            pathWrapper.path.nodes.forEach(function (node, index) {
                if (dataset.children.length > 0) {
                    var stats = dataStore.getStatsForNode(node, dataset.id);
                    if (typeof stats !== "undefined") {
                        statData.push({
                            stats: stats,
                            node: node,
                            nodeIndex: index
                        });
                    }
                }
            });


            var allSummaryPlots = $dataset.selectAll("g.nodeSummaryData")
                .data(statData, function (d) {
                    return d.node.id;
                });

            allSummaryPlots.enter()
                .append("g")
                .classed("nodeSummaryData", true)
                .each(function (statData) {
                    var axisSize = config.getNodeWidth() + s.EDGE_SIZE / 2;
                    var $summaryData = d3.select(this);
                    $summaryData.attr({
                        transform: "translate(" + (pathList.getNodePositionX(pathWrapper, statData.nodeIndex, true)) + "," + DATA_GROUP_V_PADDING + ")"
                    });

                    appendBoxPlotV($summaryData, statData.stats, scaleY, dataset.color);
                });

            allSummaryPlots
                .each(function (statData) {
                    var axisSize = config.getNodeWidth() + s.EDGE_SIZE / 2;
                    var $summaryData = d3.select(this);
                    $summaryData.transition()
                        .attr({
                            transform: "translate(" + (pathList.getNodePositionX(pathWrapper, statData.nodeIndex, true)) + "," + DATA_GROUP_V_PADDING + ")"
                        });

                    updateBoxPlotV($summaryData, statData.stats, scaleY);
                });

            allSummaryPlots.exit()
                .remove();

        };

        VDataRenderer.prototype.appendAxis = function (parent, dataset) {

            var scaleY = d3.scale.linear().domain([dataset.minValue, dataset.maxValue]).range([DATA_AXIS_SIZE, 0]);
            var yAxis = d3.svg.axis()
                .scale(scaleY)
                .orient("left")
                .tickValues([dataset.minValue, dataset.maxValue - (Math.abs(dataset.maxValue - dataset.minValue) / 2), dataset.maxValue])
                .tickSize(3, 3);

            parent.append("g")
                .classed("boxPlotAxisY", true)
                .attr("transform", "translate(" + (s.NODE_START + DATA_AXIS_WIDTH) + "," + DATA_GROUP_V_PADDING + ")")
                .call(yAxis);
        };

        VDataRenderer.prototype.onDataGroupEnter = function ($group, pathWrapper, dataset) {

            this.appendAxis($group, dataset);
        };

        VDataRenderer.prototype.onDataGroupUpdate = function ($group, pathWrapper, dataset, group) {

            if ($group.select("g.boxPlotAxisY").empty()) {
                this.appendAxis($group, dataset);
            }
        };


        VDataRenderer.prototype.onNodeDataEnter = function ($nodeData, pathWrapper, dataset, group, statData, pathList) {
            var that = this;

            var scaleY = d3.scale.linear().domain([dataset.minValue, dataset.maxValue]).range([DATA_AXIS_SIZE, 0]);

            $nodeData.attr({
                transform: "translate(" + (pathList.getNodePositionX(pathWrapper, statData.nodeIndex, true)) + "," + DATA_GROUP_V_PADDING + ")"
            });
            appendBoxPlotV($nodeData, statData.stats, scaleY, dataset.color);
        };

        VDataRenderer.prototype.onNodeDataUpdate = function ($nodeData, pathWrapper, dataset, group, statData, pathList) {
            var that = this;

            var scaleY = d3.scale.linear().domain([dataset.minValue, dataset.maxValue]).range([DATA_AXIS_SIZE, 0]);

            $nodeData.transition()
                .attr({
                    transform: "translate(" + (pathList.getNodePositionX(pathWrapper, statData.nodeIndex, true)) + "," + DATA_GROUP_V_PADDING + ")"
                });


            updateBoxPlotV($nodeData, statData.stats, scaleY);
        };

        function appendBoxPlotV(parent, stats, scaleY, color) {

            appendToolTip(parent, stats);

            parent.append("rect")
                .classed("box", true)
                .attr({
                    x: -BOX_WIDTH / 2,
                    y: scaleY(stats.quartile75),
                    width: BOX_WIDTH,
                    height: scaleY(stats.quartile25) - scaleY(stats.quartile75)
                })
                .style({
                    fill: color ? color : "gray"
                });

            parent.append("line")
                .classed("median", true)
                .attr({
                    x1: -BOX_WIDTH / 2,
                    y1: scaleY(stats.median),
                    x2: BOX_WIDTH / 2,
                    y2: scaleY(stats.median)
                })
                .style({
                    "shape-rendering": "crispEdges",
                    stroke: "white"
                });

            parent.append("rect")
                .classed("boxFrame", true)
                .attr({
                    x: -BOX_WIDTH / 2,
                    y: scaleY(stats.quartile75),
                    width: BOX_WIDTH,
                    height: scaleY(stats.quartile25) - scaleY(stats.quartile75)
                })
                .style({
                    "shape-rendering": "crispEdges",
                    fill: "rgba(0,0,0,0)",
                    stroke: "black"
                });

            appendWhiskerV(parent, stats.iqrMin, stats.quartile25, "lower", scaleY);
            appendWhiskerV(parent, stats.iqrMax, stats.quartile75, "upper", scaleY);

        }

        function updateBoxPlotV(parent, stats, scaleY) {


            parent.select("rect.box")
                .transition()
                .attr({
                    x: -BOX_WIDTH / 2,
                    y: scaleY(stats.quartile75),
                    width: BOX_WIDTH,
                    height: scaleY(stats.quartile25) - scaleY(stats.quartile75)
                });
            parent.select("rect.boxFrame")
                .transition()
                .attr({
                    x: -BOX_WIDTH / 2,
                    y: scaleY(stats.quartile75),
                    width: BOX_WIDTH,
                    height: scaleY(stats.quartile25) - scaleY(stats.quartile75)
                });

            parent.select("line.median")
                .transition()
                .attr({
                    x1: -BOX_WIDTH / 2,
                    y1: scaleY(stats.median),
                    x2: BOX_WIDTH / 2,
                    y2: scaleY(stats.median)
                });

            updateWhiskerV(parent, "lower", scaleY, stats.iqrMin, stats.quartile25);
            updateWhiskerV(parent, "upper", scaleY, stats.iqrMax, stats.quartile75);
        }


        function appendWhiskerV(parent, iqr, quartile, classNamePrefix, scaleY) {
            if (!isNaN(iqr)) {

                parent.append("line")
                    .classed(classNamePrefix + "Whisker", true)
                    .attr({
                        x1: -BOX_WIDTH / 4,
                        y1: scaleY(iqr),
                        x2: BOX_WIDTH / 4,
                        y2: scaleY(iqr)
                    })
                    .style({
                        "shape-rendering": "crispEdges",
                        stroke: "black"
                    });

                parent.append("line")
                    .classed(classNamePrefix + "WhiskerConnector", true)
                    .attr({
                        x1: 0,
                        y1: scaleY(iqr),
                        x2: 0,
                        y2: scaleY(quartile)
                    })
                    .style({
                        "shape-rendering": "crispEdges",
                        stroke: "black"
                    });
            }
        }

        function appendToolTip(parent, stats) {

            var formatter = d3.format(".4f");
            parent.append("title")
                .text("Elements: " + stats.numElements +
                "\nNaNs: " + stats.nans +
                "\nMedian: " + uiUtil.formatNumber(stats.median) +
                "\nMean: " + uiUtil.formatNumber(stats.mean) +
                "\nStandard Deviation: " + uiUtil.formatNumber(stats.std) +
                "\n1st Quartile: " + uiUtil.formatNumber(stats.quartile25) +
                "\n3rd Quartile: " + uiUtil.formatNumber(stats.quartile75) +
                "\nLowest value in 1.5xIQR range: " + uiUtil.formatNumber(stats.iqrMin) +
                "\nHighest value in 1.5xIQR range: " + uiUtil.formatNumber(stats.iqrMax) +
                "\nMin: " + uiUtil.formatNumber(stats.min) +
                "\nMax: " + uiUtil.formatNumber(stats.max)
            );
        }

        function appendBoxPlotH(parent, stats, scaleX, color) {

            //var stats = dataStore.getStatsForNode(d, dataset.name, group.name);

            appendToolTip(parent, stats);

            parent.append("rect")
                .classed("box", true)
                .attr({

                    x: scaleX(stats.quartile25),
                    y: 0,
                    width: scaleX(stats.quartile75) - scaleX(stats.quartile25),
                    height: BOX_WIDTH

                })
                .style({
                    fill: color ? color : "gray"
                });

            parent.append("line")
                .classed("median", true)
                .attr({
                    x1: scaleX(stats.median),
                    y1: 0,
                    x2: scaleX(stats.median),
                    y2: BOX_WIDTH
                })
                .style({
                    "shape-rendering": "crispEdges",
                    stroke: "white"
                });

            parent.append("rect")
                .classed("boxFrame", true)
                .attr({

                    x: scaleX(stats.quartile25),
                    y: 0,
                    width: scaleX(stats.quartile75) - scaleX(stats.quartile25),
                    height: BOX_WIDTH

                })
                .style({
                    fill: "rgba(0,0,0,0)",
                    "shape-rendering": "crispEdges",
                    stroke: "black"
                });

            appendWhiskerH(parent, stats.iqrMin, stats.quartile25, "lower", scaleX);
            appendWhiskerH(parent, stats.iqrMax, stats.quartile75, "upper", scaleX);

        }

        function updateBoxPlotH(parent, stats, scaleX) {
            parent.select("rect.box")
                .transition()
                .attr({
                    x: scaleX(stats.quartile25),
                    y: 0,
                    width: scaleX(stats.quartile75) - scaleX(stats.quartile25),
                    height: BOX_WIDTH
                });

            parent.select("rect.boxFrame")
                .transition()
                .attr({
                    x: scaleX(stats.quartile25),
                    y: 0,
                    width: scaleX(stats.quartile75) - scaleX(stats.quartile25),
                    height: BOX_WIDTH
                });

            parent.select("line.median")
                .transition()
                .attr({
                    x1: scaleX(stats.median),
                    y1: 0,
                    x2: scaleX(stats.median),
                    y2: BOX_WIDTH
                });

            updateWhiskerH(parent, "lower", scaleX, stats.iqrMin, stats.quartile25);
            updateWhiskerH(parent, "upper", scaleX, stats.iqrMax, stats.quartile75);
        }


        function updateWhiskerV(parent, classPrefix, scaleY, iqr, quartile) {
            parent.select("line." + classPrefix + "Whisker")
                .transition()
                .attr({
                    x1: -BOX_WIDTH / 4,
                    y1: scaleY(iqr),
                    x2: BOX_WIDTH / 4,
                    y2: scaleY(iqr)
                });
            parent.select("line." + classPrefix + "WhiskerConnector")
                .transition()
                .attr({
                    x1: 0,
                    y1: scaleY(iqr),
                    x2: 0,
                    y2: scaleY(quartile)
                });
        }

        function appendWhiskerH(parent, iqr, quartile, classNamePrefix, scaleX) {
            if (!isNaN(iqr)) {

                parent.append("line")
                    .classed(classNamePrefix + "Whisker", true)
                    .attr({
                        x1: scaleX(iqr),
                        y1: BOX_WIDTH / 4,
                        x2: scaleX(iqr),
                        y2: 3 * BOX_WIDTH / 4
                    })
                    .style({
                        "shape-rendering": "crispEdges",
                        stroke: "black"
                    });

                parent.append("line")
                    .classed(classNamePrefix + "WhiskerConnector", true)
                    .attr({
                        x1: scaleX(iqr),
                        y1: BOX_WIDTH / 2,
                        x2: scaleX(quartile),
                        y2: BOX_WIDTH / 2
                    })
                    .style({
                        "shape-rendering": "crispEdges",
                        stroke: "black"
                    });
            }
        }

        function updateWhiskerH(parent, classPrefix, scaleX, iqr, quartile) {
            parent.select("line." + classPrefix + "Whisker")
                .transition()
                .attr({
                    x1: scaleX(iqr),
                    y1: BOX_WIDTH / 4,
                    x2: scaleX(iqr),
                    y2: 3 * BOX_WIDTH / 4
                });
            parent.select("line." + classPrefix + "WhiskerConnector")
                .transition()
                .attr({
                    x1: scaleX(iqr),
                    y1: BOX_WIDTH / 2,
                    x2: scaleX(quartile),
                    y2: BOX_WIDTH / 2
                });
        }

        function DatasetRenderer(pathList) {
            this.pathList = pathList;
        }


        DatasetRenderer.prototype = {

            render: function () {
                if (s.isTiltAttributes()) {
                    currentDatasetGroupRenderer = vDatasetGroupRenderer;
                } else {
                    currentDatasetGroupRenderer = hDatasetGroupRenderer;
                }

                var that = this;
                var allDatasetGroups = that.pathList.parent.selectAll("g.pathContainer g.datasetGroup")
                    .data(that.pathList.pathWrappers, function (d) {
                        return d.path.id;
                    });


                allDatasetGroups.each(function (pathWrapper) {

                        var p = d3.select(this).attr({
                            transform: "translate(0," + (s.PATH_HEIGHT + pathWrapper.getSetHeight() + pathWrapper.getPropertyHeight()) + ")"
                        });

                        var allDatasets = p.selectAll("g.dataset")
                            .data(pathWrapper.datasets);

                        var dataset = allDatasets.enter()
                            .append("g")
                            .classed("dataset", true);
                        //
                        dataset.each(function (dataset) {
                            dataset.renderEnter(d3.select(this), pathWrapper, that.pathList)
                        });

                        allDatasets.attr({
                            transform: function (d, i) {
                                var posY = 0;
                                var datasetWrappers = pathWrapper.datasets;

                                for (var j = 0; j < i; j++) {
                                    var datasetWrapper = datasetWrappers[j];
                                    if (datasetWrapper.canBeShown()) {
                                        posY += datasetWrapper.getHeight();
                                    }
                                }
                                return ("translate(0, " + posY + ")");
                            }
                        });

                        allDatasets.each(function (dataset) {
                            dataset.renderUpdate(d3.select(this), pathWrapper, that.pathList);
                        });

                        allDatasets.exit().remove();

                    }
                );
            }
        };

        return {
            DatasetWrapper: DatasetWrapper,
            DataGroupWrapper: DataGroupWrapper,
            DatasetRenderer: DatasetRenderer
        };

    })
;