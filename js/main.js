import { FEATURES, normalizeSongFeatures, countryStats } from './utils.js';
import { drawMap }     from './map.js';
import { drawDotPlot } from './dotPlot.js';
import { drawLineChart } from './lineChart.js';
import { drawTreemap } from './treemap.js';
import { drawCorr     } from './corrMatrix.js';
import { drawBarChart } from './barChart.js';
import { drawBarChart2 } from './barChart2.js';  
import { drawPieChart } from './PieChart.js';  
import { drawBubbleChartForGroupSolo } from './BubbleChart.js';


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
  drawBarChart(rows);  
  drawBarChart2(rows); 
  drawBubbleChartForGroupSolo(rows);
  drawPieChart(rows);  


  const corrSvg = d3.select('#corrMatrixSVG');
  drawCorr(corrSvg, rows);

  // 绘制饼图，使用 Group.Solo 列的数据

});
