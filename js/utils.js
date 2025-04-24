export const FEATURES = [
  'energy','duration','acousticness','danceability','tempo',
  'speechiness','liveness','loudness','valence','Happiness'
];

export function normaliseSongFeatures(rows){
  const toNorm=['energy','duration','tempo','Happiness','loudness'];
  toNorm.forEach(f=>{
    const [mn,mx]=d3.extent(rows,d=>+d[f]);
    rows.forEach(r=>r[f]=(r[f]-mn)/(mx-mn));
  });
}

export function countryStats(rows){
  return new Map(Array.from(d3.group(rows,r=>r.Country),
    ([c,recs])=>[c,{
      wins:recs.filter(r=>r.Place===1).length,
      top5:recs.filter(r=>r.Place<=5).length,
      avgRank:d3.mean(recs,r=>r.Place),
      sumPoints:d3.sum(recs,r=>r.Normalized_Points)
    }]));
}

export function showTooltip(html,[x,y]){
  d3.select('#tooltip').style('visibility','visible')
    .html(html).style('left',`${x}px`).style('top',`${y}px`);
}
export function hideTooltip(){d3.select('#tooltip').style('visibility','hidden')}