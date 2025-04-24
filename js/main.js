import { FEATURES, normalizeSongFeatures, countryStats } from './utils.js';
import { drawMap }     from './map.js';
import { drawDotPlot } from './dotPlot.js';
import { drawLineChart } from './lineChart.js';
import { drawTreemap } from './treemap.js';
import { drawCorr     } from './corrMatrix.js';
import { drawKeyBarChart } from './keyBarChart.js';
import { drawTimeSigBarChart } from './timeSigBarChart.js';  
import { drawPieChart } from './pieChart.js';  
import { drawBubbleChartForGroupSolo } from './bubbleChart.js';


const DATA_SONGS  = 'data/eurovision_1998_to_2012.csv';
const DATA_VOTES  = 'data/eurovision_1998_to_2012_voting.csv';
const WORLD_URL   = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

Promise.all([
  d3.csv(DATA_SONGS,d3.autoType),
  d3.csv(DATA_VOTES,d3.autoType),
  d3.json(WORLD_URL)
]).then(([rows,voting,world]) => {

  /* tidy vote fields */
  voting.forEach(d => {
    d.Giver = d.Giver?.trim();
    d.Country = d.Country?.trim();
    d.Score = +d.Score;
  });

  normalizeSongFeatures(rows);
  const stats = countryStats(rows);

  /* draw all views */
  const mapApi = drawMap(rows, voting, world, stats);   // exposes colourMap(year)

  drawDotPlot(rows);
  drawLineChart(rows);
  drawTreemap(rows);
  drawKeyBarChart(rows);  
  drawTimeSigBarChart(rows); 
  drawBubbleChartForGroupSolo(rows);
  drawPieChart(rows);  


  const corrSvg = d3.select('#corrMatrixSVG');
  drawCorr(corrSvg, rows);

});
