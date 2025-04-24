import { FEATURES, showTooltip, hideTooltip } from './utils.js';

export function drawTreemap(rows){
  const svg = d3.select('#treemapSVG');
  const W = svg.node().getBoundingClientRect().width;
  const H = svg.node().getBoundingClientRect().height;

  // Bucket function: groups rank Place values
  const bucket = p => {
    const g = Math.ceil(p / 5);
    return g <= 4 ? `${(g-1)*5+1}-${g*5}` : 'Rest';
  };

  // Group rows by bucket and determine the dominant feature for each bucket
  let groups = Array.from(
    d3.group(rows, r => bucket(r.Place)),
    ([lab, recs]) => {
      // For each feature, calculate the average normalised value in this bucket
      const featureAvg = FEATURES.map(f => ({
        feature: f,
        avg: d3.mean(recs, d => +d[f]) || 0
      }));
      // Choose the feature with the highest average
      const dominant = featureAvg.reduce((a,b) => a.avg > b.avg ? a : b).feature;
      return { lab, count: recs.length, feat: dominant };
    }
  );

  // Define desired bucket order so that better ranks appear first
  const bucketOrder = { '1-5': 1, '6-10': 2, '11-15': 3, '16-20': 4, 'Rest': 5 };
  groups.sort((a, b) => (bucketOrder[a.lab] || 99) - (bucketOrder[b.lab] || 99));

  // Build a hierarchy from the groups
  const root = d3.hierarchy({ children: groups }).sum(d => d.count);
  d3.treemap().size([W, H]).padding(1)(root);

  // Create a colour scale for the features
  const colour = d3.scaleOrdinal().domain(FEATURES).range(d3.schemeTableau10);

  // Render the treemap nodes
  const node = svg.selectAll('g.node')
      .data(root.leaves())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

  node.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => colour(d.data.feat));

  node.append('text')
      .attr('x', 3)
      .attr('y', 12)
      .text(d => d.data.lab)
      .attr('font-size', '10px')
      .attr('fill', '#fff');

  node.on('mouseover',(e,d)=>{
      showTooltip(
        `<strong>${d.data.lab}</strong><br>Dominant: ${d.data.feat}<br>Songs: ${d.data.count}`,
        [e.pageX+10,e.pageY+10]
      );
    }).on('mouseout', hideTooltip);
}