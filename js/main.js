
let barChart;

loadData();

/* Data definitions
 * index                -- unique ID for each entry
 * accNum               -- unique ID for each collision, not unique for each entry as some entries represent the same collision for different
 *                         involved persons (i.e. one entry for driver, one for pedestrian)
 * date                 -- date of collision
 * time                 -- time of collision
 * drivType             -- if entry represents driver, driver manoeuver (i.e. changing lanes, going ahead, U-turn etc.)
 * drivAct              -- if entry represents driver, improper or illegal move made by driver (i.e. disobeyed traffic control, improper lane 
 *                         change, lost control)
 * drivCond             -- if entry represents driver, driver condition (i.e. ability impaired, fatigue, inattentive etc.)
 * pedType              -- if entry represents pedestrian, details on pedestrian crash
 * pedAct               -- if entry represents pedestrian, what the pedestrian was doing moments before the crash
 * pedCond              -- if entry represents pedestrian, pedestrian condition (i.e. ability impaired, fatigue, inattentive etc.)
 */

function loadData() {
    d3.csv("data/collisions.csv", d => {
        if (d.PEDESTRIAN == "Yes") {        // only keep rows where a pedestrian was involved in a collision 
            return {
                index: +d.OBJECTID,         
                accNum: +d.ACCNUM,          
                date: d.DATE,               
                time: d.TIME,               
                manoeuver: d.MANOEUVER,     
                drivAct: d.DRIVACT,         
                drivCond: d.DRIVCOND,       
                pedType: d.PEDTYPE,         
                pedAct: d.PEDACT,          
                pedCond: d.PEDCOND   
            };
        }
    }).then(data => {
        console.log(data)

        barChart = new BarChart("bar-chart", data);

        barChart.initVis();
    });
}