/* global d3 _ jLouvain window document */
/* eslint-disable newline-per-chained-call */

import ticked from './ticked';
import dragstarted from './dragstarted';
import dragged from './dragged';
import dragended from './dragended';

export default function render(selector, inputData, options) {
  const width = 960; // window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  const height = 600; // window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  const linkWeightThreshold = 0.79;
  const soloNodeLinkWeightThreshold = 0.1;
  const labelTextScalingFactor = 28;

  const mouseOverFunction = function (d) {
    const circle = d3.select(this);

    node
      .transition(500)
        .style('opacity', o => {
          const isConnectedValue = isConnected(o, d);
          if (isConnectedValue) {
            return 1.0;
          }
          return 0.2
        })
        .style('fill', (o) => {
          let fillColor;
          if (isConnectedAsTarget(o, d) && isConnectedAsSource(o, d)) {
            fillColor = 'green';
          } else if (isConnectedAsSource(o, d)) {
            fillColor = 'red';
          } else if (isConnectedAsTarget(o, d)) {
            fillColor = 'blue';
          } else if (isEqual(o, d)) {
            fillColor = 'hotpink';
          } else {
            fillColor = '#000';
          }
          return fillColor;
        });

    link
      .transition(500)
        .style('stroke-opacity', o => (o.source === d || o.target === d ? 1 : 0.2))
        .transition(500)
        .attr('marker-end', o => (o.source === d || o.target === d ? 'url(#arrowhead)' : 'url()'));

    // circle
    //   .transition(500)
    //     .attr('r', () => {
    //       console.log('d from mouseover circle radius', d);
    //       return 1.4 * 4;
    //     });
  };

  const mouseOutFunction = function () {
    const circle = d3.select(this);
  
    node
      .transition(500);
  
    link
      .transition(500);
  
    // circle
    //   .transition(500)
    //     .attr('r', 4);
  };

  const svg = d3.select(selector).append('svg')
    .attr('width', width)
    .attr('height', height);

  const simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id))
    .force('charge', d3.forceManyBody().strength(-1000))
    .force('center', d3.forceCenter(width / 2, height / 2));

  const defaultNodeRadius = '9px';

  const linkWidthScale = d3.scalePow()
    .exponent(2)
    .domain([0, 1])
    .range([0, 5]);

  // http://colorbrewer2.org/?type=qualitative&scheme=Paired&n=12
  const boldAlternating12 = [
    '#1f78b4',
    '#33a02c',
    '#e31a1c',
    '#ff7f00',
    '#6a3d9a',
    '#b15928',
    '#a6cee3',
    '#b2df8a',
    '#fb9a99',
    '#fdbf6f',
    '#cab2d6',
    '#ffff99',
  ];

  const textMainGray = '#635F5D';

  const color = d3.scaleOrdinal()
    .range(boldAlternating12);

  //
  // data-driven code starts here
  //

  const graph = inputData;
  const nodes = _.cloneDeep(graph.nodes);
  const links = _.cloneDeep(graph.edges);

  const staticLinks = graph.edges;
  const linksAboveThreshold = [];
  staticLinks.forEach(d => {
    if (d.weight > linkWeightThreshold) {
      linksAboveThreshold.push(d);
    }
  });
  const linksForCommunityDetection = linksAboveThreshold;

  const nodesAboveThresholdSet = d3.set();
  linksAboveThreshold.forEach(d => {
    nodesAboveThresholdSet.add(d.source);
    nodesAboveThresholdSet.add(d.target);
  });
  const nodesAboveThresholdIds = nodesAboveThresholdSet
    .values()
    .map(d => Number(d));
  const nodesForCommunityDetection = nodesAboveThresholdIds;

  //
  // manage threshold for solo nodes
  //

  const linksAboveSoloNodeThreshold = [];
  staticLinks.forEach(d => {
    if (d.weight > soloNodeLinkWeightThreshold) {
      linksAboveSoloNodeThreshold.push(d);
    }
  });
  const nodesAboveSoloNodeThresholdSet = d3.set();
  linksAboveSoloNodeThreshold.forEach(d => {
    nodesAboveSoloNodeThresholdSet.add(d.source);
    nodesAboveSoloNodeThresholdSet.add(d.target);
  });
  const soloNodesIds = nodesAboveSoloNodeThresholdSet
    .values()
    .map(d => Number(d));

  //
  //
  //

  console.log('nodes', nodes);
  console.log('nodesAboveThresholdIds', nodesAboveThresholdIds);
  console.log('nodesForCommunityDetection', nodesForCommunityDetection);
  console.log('staticLinks', staticLinks);
  console.log('linksAboveThreshold', linksAboveThreshold);
  console.log('linksForCommunityDetection', linksForCommunityDetection);

  //
  // calculate degree for each node
  // where `degree` is the number of links
  // that a node has
  //

  nodes.forEach(d => {
    d.inDegree = 0;
    d.outDegree = 0;
  });
  links.forEach(d => {
    nodes[d.source].outDegree += 1;
    nodes[d.target].inDegree += 1;
  });

  //
  // detect commnunities
  //

  const communityFunction = jLouvain()
    .nodes(nodesForCommunityDetection)
    .edges(linksForCommunityDetection);

  const communities = communityFunction();
  console.log('communities from jLouvain', communities);

  //
  // collect in-links for each node
  //

  console.log('links', links);
  const inLinksByNodeHash = {};
  links.forEach(link => {
    if (typeof inLinksByNodeHash[link.target] === 'undefined') {
      inLinksByNodeHash[link.target] = [];
    }
    inLinksByNodeHash[link.target].push(link);
  })
  console.log('inLinksByNodeHash', inLinksByNodeHash); 

  //
  // collect out-links for each node
  //

  const outLinksByNodeHash = {};
  links.forEach(link => {
    if (typeof outLinksByNodeHash[link.source] === 'undefined') {
      outLinksByNodeHash[link.source] = [];
    }
    outLinksByNodeHash[link.source].push(link);
  })
  console.log('outLinksByNodeHash', outLinksByNodeHash);

  //
  // collect neighbors for each node
  //

  const neighborsByNodeHash = {};
  nodes.forEach(node => neighborsByNodeHash[node.id] = d3.set());

  nodes.forEach(node => {
    if (typeof inLinksByNodeHash[node.id] !== 'undefined') {
      inLinksByNodeHash[node.id].forEach(inLink => {
        neighborsByNodeHash[node.id].add(inLink.source);
      })
    }
    console.log('outLinksByNodeHash', outLinksByNodeHash)
    console.log('node.id', node.id);
    if (typeof outLinksByNodeHash[node.id] !== 'undefined') {
      outLinksByNodeHash[node.id].forEach(outLink => {
        neighborsByNodeHash[node.id].add(outLink.target);
      })
    }
  });
  console.log('neighborsByNodeHash', neighborsByNodeHash);

  //
  // now we draw elements on the page
  //

  const link = svg.append('g')
    .style('stroke', '#aaa')
    .selectAll('line')
      .data(links)
      .enter().append('line')
      .style('stroke-width', d => linkWidthScale(d.weight));


  const nodesParentG = svg.append('g')
    .attr('class', 'nodes');

  // const boundMouseover = mouseover.bind(this);
  const boundDragstarted = dragstarted.bind(this, simulation);
  const boundDragended = dragended.bind(this, simulation);

  const nodeG = nodesParentG
    .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('id', d => `node${d.id}`)
      .call(d3.drag()
        .on('start', boundDragstarted)
        .on('drag', dragged)
        .on('end', boundDragended)
      );

  const nodeRadiusScale = d3.scaleLinear()
    .domain([0, nodes.length])
    .range([5, 30]);

  const backgroundNode = nodeG
    .append('circle')
      .attr('r', d => `${nodeRadiusScale(d.inDegree)}px`)
      .classed('background', true);

  const node = nodeG
    .append('circle')
      .attr('r', d => `${nodeRadiusScale(d.inDegree)}px`)
      .on('mouseover', mouseOverFunction)
      .on('mouseout', mouseOutFunction)
      .classed('mark', true);

  node
    .data(nodes)
    .append('title')
      .text(d => d.name);


  const label = nodeG.append('text')
    .text(d => d.name)
    .style('font-size', function (d) {
      return `${
        Math.max(
          Math.min(
            2 * nodeRadiusScale(d.inDegree),
            (2 * nodeRadiusScale(d.inDegree) - 8) / this.getComputedTextLength() * labelTextScalingFactor
          ),
          8
        )
      }px`;
    })
    .style('fill', '#666')
    .attr('class', 'label')
    .attr('dx', function (d) {
      const dxValue = `${-1 * (this.getComputedTextLength() / 2)}px`;
      return dxValue;
    })
    .attr('dy', '.35em');

  const toolTip = svg.append('g')
    .attr('class', 'toolTips')
    .selectAll('text')
    .data(nodes)
    .enter().append('title')
      .attr('class', 'label')
      .style('fill', '#666')
      .style('font-size', 20)
      .text(d => d.name);

  const boundTicked = ticked.bind(
    this,
    link,
    soloNodesIds,
    textMainGray,
    color,
    communities,
    nodeG,
    backgroundNode,
    node
  );

  simulation
    .nodes(nodes)
    .on('tick', boundTicked);

  simulation.force('link')
    .links(links);

  let linkedByIndex = {};
  links.forEach((d) => {
    linkedByIndex[`${d.source.index},${d.target.index}`] = true;
  });

  function isConnected(a, b) {
    return isConnectedAsTarget(a, b) || isConnectedAsSource(a, b) || a.index === b.index;
  }
  
  function isConnectedAsSource(a, b) {
    return linkedByIndex[`${a.index},${b.index}`];
  }
  
  function isConnectedAsTarget(a, b) {
    return linkedByIndex[`${b.index},${a.index}`];
  }
  
  function isEqual(a, b) {
    return a.index === b.index;
  }
/*
  function mouseover() {
    console.log('arguments from mouseover', arguments);
    const selectedNodeId = d3.select(this).attr('id');
    console.log('selectedNodeId', selectedNodeId);

    const parentG = d3.select(this).node().parentNode;
    const gSelection = d3.select(parentG).selectAll('g')
      .filter((d, i, nodes) => {
        // console.log('nodes[i] from mouseover', nodes[i]);
        const isSelectedNode = nodes[i].id !== selectedNodeId;

        let isNeighbor = false;
        if (!isSelectedNode) {
          const currentNodeIndex = Number(nodes[i].id.split('node')[1]);
          const selectedNodeIndex = Number(selectedNodeId.split('node')[1]);
          console.log('currentNodeIndex', currentNodeIndex);
          console.log('selectedNodeIndex', selectedNodeIndex);

          const selectedNeighbors = neighborsByNodeHash[selectedNodeIndex].values();
          isNeighbor = selectedNeighbors.indexOf(currentNodeIndex) > -1;
        }
        const returnValue = isSelectedNode || !isNeighbor;
        console.log('returnValue', returnValue);
        return returnValue;
      });

    // fade out faraway nodes
    gSelection
      .select('.mark')
      .style('fill-opacity', 0.1);

    // fade out labels of faraway nodes
    gSelection
      .select('text')
      .style('opacity', 0.1);
  }

  function mouseout() {
    const currentNodeId = d3.select(this).attr('id');
    // console.log('currentNodeId', currentNodeId);

    const parentG = d3.select(this).node().parentNode;
    const gSelection = d3.select(parentG).selectAll('g')
      .selectAll('.mark')
      .style('fill-opacity', 0.4);

    d3.select(parentG).selectAll('text')
      .style('opacity', 1);
  }
*/
}
