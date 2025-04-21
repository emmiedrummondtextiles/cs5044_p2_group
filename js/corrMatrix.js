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
    const bbox = svg.node().getBoundingClientRect();
    W = bbox.width || 500;
    H = bbox.height || 500;
  }

  // Use extra margin for the axis labels
  const marginBottom = 40;
  const marginLeft = 50;  // extra left margin for y-axis labels
  const cell = Math.min(W - marginLeft, H - marginBottom) / numeric.length;
  const matrixSize = cell * numeric.length;

  // update the SVG dimensions to include the margins
  svg.attr('width', matrixSize + marginLeft)
     .attr('height', matrixSize + marginBottom);

  // Create colour scale
  const colour = d3.scaleSequential(d3.interpolateRdBu).domain([-1, 1]);

  // clear previous drawing
  svg.selectAll('*').remove();

  // Group for matrix cells
  const cellGroup = svg.append("g")
    .attr("class", "cells")
    .attr("transform", `translate(${marginLeft},0)`);
    
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

  // Group for x axis labels – placed in the extra bottom margin
  const xLabels = svg.append("g")
    .attr("class", "x-labels")
    .attr("transform", `translate(${marginLeft},0)`);
    
  xLabels.selectAll('text')
    .data(numeric)
    .enter().append('text')
      .attr('transform', (_, i) => `translate(${i * cell + cell/2}, ${matrixSize + marginBottom/2}) rotate(-45)`)
      .attr('text-anchor', 'middle')
      .text(d => d)
      .attr('font-size', '10px')
      .attr('fill', '#555');

  // Group for y axis labels – placed in the left margin
  const yLabels = svg.append("g")
    .attr("class", "y-labels");
    
  yLabels.selectAll('text')
    .data(numeric)
    .enter().append('text')
      .attr('x', marginLeft - 5)
      .attr('y', (_, i) => i * cell + cell/2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text(d => d)
      .attr('font-size', '10px')
      .attr('fill', '#555');
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