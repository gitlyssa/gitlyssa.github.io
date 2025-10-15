
/*
 * BarChart - ES6 Class
 * @param  parentElement 	-- the HTML element in which to draw the visualization
 * @param  data             -- raw data; this should never be modified directly
 * @param  displayData      -- the data which will be displayed; set equal to transformations made onto data
 */

class BarChart {
    constructor(parentElement, data) {
        this.parentElement = parentElement;
        this.data = data;
        this.displayData = data;
    }

    /*
	 * Method that initializes the visualization (static content, e.g. SVG area or axes)
 	*/
    initVis() {
        let vis = this;

        vis.data = vis.data.filter(d => d.pedAct)

        // Margins ad dimensions
		vis.margin = {top: 40, right: 40, bottom: 60, left: 200};
		vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
		vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

		// SVG drawing area
		vis.svg = d3.select("#" + vis.parentElement).append("svg")
			.attr("width", vis.width + vis.margin.left + vis.margin.right)
			.attr("height", vis.height + vis.margin.top + vis.margin.bottom)
			.append("g")
			.attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")");


        // stick figure (load once)
        vis.iconReady = d3.xml("svg/stickfigure.svg").then(data => {
        const imported = document.importNode(data.documentElement, true);
        // ensure we append the <symbol> into our chart's <defs>
        const defs = vis.svg.select("defs").empty() ? vis.svg.append("defs") : vis.svg.select("defs");
        defs.node().appendChild(imported.querySelector("symbol")); // id="icon-stick"
        });

        // Aggregate counts per pedAct
        vis.counts = Array.from(
            d3.rollup(
                vis.data,
                v => v.length,
                d => d.pedAct
            ),
            ([pedAct, count]) => ({ pedAct, count })
        );

        // Sort ascending by count
        vis.counts.sort((a, b) => b.count - a.count);

        // Scales and axes
        vis.xScale = d3.scaleLinear()
            .range([0, vis.width])
            .domain([0, d3.max(vis.counts, d => d.count) + 30]);  // added 30 for padding  & making it based off vis.counts
        
        vis.yScale = d3.scaleBand()
            .domain(vis.counts.map(d => d.pedAct)) 
            .range([vis.height, 0])
            .padding(0.1);

        vis.colorScale = d3.scaleOrdinal()
            .domain(vis.data.map(d => d.pedAct))
            .range([
                "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948",
                "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC", "#8DD3C7", "#FDB462",
                "#B3DE69", "#FCCDE5", "#80B1D3", "#BC80BD"
            ]);

        vis.xAxis = d3.axisBottom()
            .scale(vis.xScale);

        vis.yAxis = d3.axisLeft()
            .scale(vis.yScale);
        
        vis.svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${vis.height})`)
            .call(vis.xAxis);

        vis.svg.append("g")
            .attr("class", "y-axis")
            .call(vis.yAxis);

        vis.updateVis();
    }

    /*
 	* Data wrangling
 	*/
	wrangleData(){
		vis.updateVis();
	}

    /*
	 * The drawing function - should use the D3 update sequence (enter, update, exit)
 	* Function parameters only needed if different kinds of updates are needed
 	*/

    updateVis(){
        const vis = this;
        const animationDelay = 180;
        const barCount = vis.counts.length;

    // bars
        const bars = vis.svg.selectAll(".bar")
            .data(vis.counts, d => d.pedAct); 

        const barsEnter = bars.enter().append("rect")
            .attr("class", "bar")
            .attr("y", d => vis.yScale(d.pedAct))
            .attr("height", vis.yScale.bandwidth())
            .attr("x", 0)
            .attr("width", 0) // starting at 0 for animatio
            .attr("fill", d => vis.colorScale(d.pedAct));

        const barsMerged = barsEnter.merge(bars);

        barsMerged
            .transition() //animation attempt
            .delay((d, i) => (barCount - i) * animationDelay) // staggering it using index also, (barCount - i) makes it go reverse instead
            .duration(800)
            .ease(d3.easeCubicOut)
            .attr("width", d => vis.xScale(d.count));

        bars.exit().remove();

        // DO THE SAME FOR LABELS
        const labels = vis.svg.selectAll(".bar-label")
            .data(vis.counts, d => d.pedAct);

        const labelsEnter = labels.enter().append("text")
            .attr("class", "bar-label")
            .attr("x", 5) // start near the axis?
            .attr("y", d => vis.yScale(d.pedAct) + vis.yScale.bandwidth()/2)
            .attr("dy", "0.35em")
            .attr("opacity", 0)
            .text(d => d.count);

        const labelsMerged = labelsEnter.merge(labels)
            .text(d => d.count);

            labelsMerged
                .transition()
                .delay((d, i) => (barCount - i) * animationDelay)
                .duration(800)
                .ease(d3.easeCubicOut)
                .attr("x", d => vis.xScale(d.count) + 5)
                .attr("opacity", 1);

        labels.exit().remove();


        // SAME FOR THE STICK FIGURES ANIAMTION
        const GAP = 13;   // gap from the end of the bar      
        const figures_size = 0.05;

        vis.iconReady && vis.iconReady.then(() => {
            const icons = vis.svg.selectAll(".bar-icon")
                .data(vis.counts, d => d.pedAct);

            const iconsEnter = icons.enter() // How the stick figures come into the visual initially
                .append("use")
                .attr("class", "bar-icon")
                .attr("href", "#icon-stick")
                .attr("xlink:href", "#icon-stick")
                .style("color", d => vis.colorScale(d.pedAct))
                .style("opacity", 0)
                .attr("transform", d => {
                const y = vis.yScale(d.pedAct) + vis.yScale.bandwidth()/2;
                const x = vis.xScale(0) + GAP;
                return `translate(${x},${y}) scale(${figures_size})`;
                });

            iconsEnter.merge(icons) // how the stick figures animate to the end of the bar
                .transition()
                .delay((d, i) => (barCount - 1 - i) * animationDelay)
                .duration(800)
                .ease(d3.easeCubicOut)
                .style("opacity", 1)
                .attr("transform", d => {
                const y = vis.yScale(d.pedAct); // added 30 just to fix it a bit
                const x = vis.xScale(d.count) + GAP; // right end
                return `translate(${x},${y}) scale(${figures_size})`;
                });

            icons.exit().remove();
        });


        vis.svg.select(".x-axis")
            .transition()
            .delay(100)
            .duration(600)
            .ease(d3.easeCubicOut)
            .call(vis.xAxis);

        vis.svg.select(".y-axis").call(vis.yAxis);
        
    }

}