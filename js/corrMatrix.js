import { FEATURES } from './utils.js';
import { showTooltip, hideTooltip } from './utils.js';
import { showViolin } from './violin.js';

export function drawCorr(svg, rows) {
  // list of numeric columns
  const numeric = ['Normalized_Points', 'Song_Quality', 'Place', ...FEATURES];

  // compute correlation matrix
  const matrix = numeric.flatMap((c1, i) =>
    numeric.map((c2, j) => ({
      x: j,
      y: i,
      col1: c1,
      col2: c2,
      corr: calcCorr(
        rows.map(r => r[c1]).filter(v => isFinite(v)),
        rows.map(r => r[c2]).filter(v => isFinite(v))
      )
    }))
  );

  // Ensure valid SVG dimensions:
  let W = +svg.attr('width');
  let H = +svg.attr('height');
  if (!W || !H) {
    // If width/height attributes are not set, fallback to the element's bounding box
    const bbox = svg.node().getBoundingClientRect();
    W = bbox.width || 500;
    H = bbox.height || 500;
  }
  const cell = Math.min(W, H) / numeric.length;

  // Create colour scale
  const colour = d3.scaleSequential(d3.interpolateRdBu).domain([-1, 1]);

  // clear previous drawing
  svg.selectAll('*').remove();

  // Group for matrix cells
  const cellGroup = svg.append("g").attr("class", "cells");
  cellGroup.selectAll('rect')
    .data(matrix)
    .enter().append('rect')
      .attr('x', d => d.x * cell)
      .attr('y', d => d.y * cell)
      .attr('width', cell)
      .attr('height', cell)
      .attr('fill', d => colour(d.corr))
      .on('mouseover', (e, d) =>
        showTooltip(
          `<strong>${d.col1} vs ${d.col2}</strong><br>r = ${isNaN(d.corr) ? "N/A" : d.corr.toFixed(2)}`,
          [e.pageX + 10, e.pageY + 10]
        )
      )
      .on('mouseout', hideTooltip)
      .on('click', (e, d) => {
        if (d.col1 !== d.col2) showViolin(d.col1, d.col2, rows);
      });

  // Group for axis labels
  const labelGroup = svg.append("g").attr("class", "axis-labels");
  labelGroup.selectAll('text.axis')
    .data(numeric)
    .enter().append('text')
      .attr('class', 'axis')
      .attr('transform', (_, i) =>
        `translate(${i * cell + cell/2}, ${numeric.length * cell + 12}) rotate(-45)`
      )
      .attr('text-anchor', 'middle')
      .text(d => d)
      .attr('font-size', '10px');
}

// simple Pearson correlation calculation
function calcCorr(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return NaN;
  const meanA = d3.mean(a), meanB = d3.mean(b);
  const num = d3.sum(a.map((v, i) => (v - meanA) * (b[i] - meanB)));
  const den = Math.sqrt(
    d3.sum(a.map(v => (v - meanA) ** 2)) *
    d3.sum(b.map(v => (v - meanB) ** 2))
  );
  return den === 0 ? 0 : num / den;
}