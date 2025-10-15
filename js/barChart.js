
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

        // Aggregate counts per pedAct
        vis.counts = Array.from(
            d3.rollup(
                vis.data,
                v => v.length,
                d => d.pedAct
            ),
            ([pedAct, count]) => ({ pedAct, count })
        );

        // Scales and axes
        vis.xScale = d3.scaleLinear()
            .range([0, vis.width])
            .domain([0, vis.data.length]);  
        
        vis.yScale = d3.scaleBand()
            .domain(vis.data.map(d => d.pedAct))
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
		let vis = this;
        
        vis.svg.selectAll(".bar")
            .data(vis.counts)
            .join("rect")
            .attr("class", "bar")
            .attr("y", d => vis.yScale(d.pedAct))
            .attr("height", vis.yScale.bandwidth())
            .attr("x", 0)
            .attr("width", d => vis.xScale(d.count))
            .attr("fill", d => vis.colorScale(d.pedAct));
        
        vis.svg.selectAll(".bar-label")
            .data(vis.counts)
            .join("text")
            .attr("class", "bar-label")
            .attr("x", d => vis.xScale(d.count) + 5)
            .attr("y", d => vis.yScale(d.pedAct) + vis.yScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .text(d => d.count);
	}
}