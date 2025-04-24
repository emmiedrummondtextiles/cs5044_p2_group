import { FEATURES, showTooltip, hideTooltip } from './utils.js';

export function showRadar(song){
  const div = d3.select('#radarContainer'); 
  div.selectAll('*').remove();
  if (!song) return;

  const size = 260, radius = size/2 - 30;
  // Construct data: for each feature, get the normalised value from the song (or 0)
  const data = FEATURES.map(f => ({ axis: f, value: +song[f] || 0 }));
  // Angle for each feature (vertex)
  const angle = i => Math.PI * 2 / FEATURES.length * i - Math.PI / 2;
  // r scale converts normalised value (0-1) to a pixel distance from center
  const r = d3.scaleLinear().domain([0, 1]).range([0, radius]);

  const svg = div.append('svg')
      .attr('width', size)
      .attr('height', size)
      .append('g')
      .attr('transform', `translate(${size/2},${size/2})`);

  // Draw concentric circles
  d3.range(1, 6).forEach(l => 
    svg.append('circle')
      .attr('r', radius * l/5)
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
  );

  // Draw the axes
  svg.selectAll('line.axis')
     .data(FEATURES)
     .enter().append('line')
       .attr('x1', 0)
       .attr('y1', 0)
       .attr('x2', (d, i) => r(1) * Math.cos(angle(i)))
       .attr('y2', (d, i) => r(1) * Math.sin(angle(i)))
       .attr('stroke', '#999');

  // Draw feature labels at the edge
  svg.selectAll('text')
     .data(FEATURES)
     .enter().append('text')
       .attr('x', (d, i) => r(1.1) * Math.cos(angle(i)))
       .attr('y', (d, i) => r(1.1) * Math.sin(angle(i)))
       .attr('text-anchor', 'middle')
       .attr('font-size', '10px')
       .text(d => d);

  // Calculate vertices from the data
  const vertices = data.map((d, i) => [
    r(d.value) * Math.cos(angle(i)),
    r(d.value) * Math.sin(angle(i))
  ]);

  const points = vertices.map(p => p.join(',')).join(' ');

  // Use a polygon to draw the radar chart
  svg.append('polygon')
     .attr('points', points)
     .attr('fill', 'orange')
     .attr('fill-opacity', 0.5)
     .attr('stroke', 'orangered')
     .attr('stroke-width', 2);

  // Add dots at each vertex. Hovering on a dot shows the feature name and value.
  svg.selectAll('circle.vertex')
     .data(data)
     .enter().append('circle')
       .attr('class', 'vertex')
       .attr('cx', (d, i) => r(d.value) * Math.cos(angle(i)))
       .attr('cy', (d, i) => r(d.value) * Math.sin(angle(i)))
       .attr('r', 4)
       .attr('fill', 'orangered')
       .on('mouseover', (e, d) => {
         showTooltip(
           `<strong>${d.axis}</strong><br>Value: ${d.value.toFixed(2)}`,
           [e.pageX + 10, e.pageY + 10]
         );
       })
       .on('mouseout', hideTooltip);

  // Add label for winner details below the radar chart
  div.append('p').html(
    `<strong>${song.Year}</strong> winner: <em>${song.Song}</em> (${song.Country})`
  );
}