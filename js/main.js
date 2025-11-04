let barChart;

/* Map long PEDACT labels to concise display names */
const pedActMap = {
  "Coming From Behind Parked Vehicle": "Behind parked vehicle",
  "Crossing marked crosswalk without ROW": "Crossing without right of way",
  "Crossing, no Traffic Control": "Crossing with no traffic control",
  "Crossing, Pedestrian Crossover": "Crossing with right of way",
  "On Sidewalk or Shoulder": "On sidewalk or shoulder",
  "Person Getting on/off School Bus": "(Un)boarding vehicle",
  "Person Getting on/off Vehicle": "(Un)boarding vehicle",
  "Playing or Working on Highway": "Working on highway",
  "Running onto Roadway": "Ran onto road",
  "Walking on Roadway Against Traffic": "Walking along road",
  "Walking on Roadway with Traffic": "Walking along road"
};

function classifySeverity(acclass){
  const s = String(acclass || '').toLowerCase().replace(/\s+/g,' ').trim();
  if (s.includes('non-fatal')) return 'nonfatal';
  if (s.includes('fatal'))     return 'fatal';
  return 'nonfatal';
}

function timeBandFromNUM(t){
  const n = +t; if (!Number.isFinite(n)) return undefined;
  const h = Math.floor(n/100) % 24;
  if (h < 6) return "Night";
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

loadData();

function loadData() {
  d3.csv("data/collisions.csv", d => {
    if (d.PEDESTRIAN === "Yes") {
      return {
        index: +d.OBJECTID,
        accNum: +d.ACCNUM,
        date: d.DATE,
        time: d.TIME,
        manoeuver: d.MANOEUVER,
        drivAct: d.DRIVACT,
        drivCond: d.DRIVCOND,
        pedType: d.PEDTYPE,
        pedAct: pedActMap[d.PEDACT] || d.PEDACT,
        pedCond: d.PEDCOND,
        timeBand: timeBandFromNUM(d.TIME),
        severity: classifySeverity(d.ACCLASS)
      };
    }
  }).then(data => {
    barChart = new BarChart("bar-chart", data);
    barChart.initVis();
  });
}
