import { FEATURES, showTooltip, hideTooltip } from './utils.js';

export function drawDotPlot(rows){
  const svg = d3.select('#dotplotSVG');
  const { width, height } = svg.node().getBoundingClientRect();

  const artists = Array.from(
    d3.rollup(
      rows,
      v => ({
        appearances: v.length,
        country: v[0].Country,
        // Normalise gender value; trim and fallback to 'N/A'
        gender: v[0].Artist_gender ? v[0].Artist_gender.trim() : 'N/A',
        total: d3.sum(v, r => r.Normalized_Points),
        years: [...new Set(v.map(r => r.Year))].join(', '),
        songs: v.map(r => r.Song).join('; ')
      }),
      r => r.Artist
    ),
    ([Artist, data]) => ({ Artist, ...data })
  );

  // Define the explicit order for gender and the corresponding colours
  const genderDomain = ['Male', 'Female', 'Both', 'N/A'];
  const colour = d3.scaleOrdinal()
                  .domain(genderDomain)
                  .range(['blue', 'pink', 'green', 'grey']);

  // Use an ordinal x-axis so that missing or 'N/A' values land in the correct position
  const x = d3.scalePoint()
              .domain(genderDomain)
              .range([80, width - 40])
              .padding(0.5);
  const y = d3.scaleLinear()
              .domain([0, d3.max(artists, d => d.total)])
              .nice()
              .range([height - 40, 40]);
  const r = d3.scaleSqrt()
              .domain(d3.extent(artists, d => d.appearances))
              .range([4, 18]);

  svg.append('g')
     .attr('transform', `translate(0,${height - 40})`)
     .call(d3.axisBottom(x));
  svg.append('g')
     .attr('transform', 'translate(60,0)')
     .call(d3.axisLeft(y));

  svg.selectAll('circle').data(artists).join('circle')
    // Ensure that if d.gender is not one of the domain values, default to 'N/A'
    .attr('cx', d => {
      const g = genderDomain.includes(d.gender) ? d.gender : 'N/A';
      return x(g) + (Math.random() - 0.5) * 12;
    })
    .attr('cy', d => y(d.total))
    .attr('r', d => r(d.appearances))
    .attr('fill', d => colour(genderDomain.includes(d.gender) ? d.gender : 'N/A'))
    .attr('fill-opacity', 0.6)
    .attr('stroke', '#333')
    .on('mouseover', (e, d) => {
      showTooltip(`<strong>${d.Artist}</strong> (${d.country})<br>
        Σ points: ${d.total}<br>Appearances: ${d.appearances}<br>Years: ${d.years}`,
        [e.pageX + 12, e.pageY + 12]);
    })
    .on('mouseout', hideTooltip);
}