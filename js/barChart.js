
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
        this.currentYear = 2007; // Change to a year with more data
        this.laneDividersCreated = false;
        this.isPlaying = false;
        this.playInterval = null;
    }

    /*
	 * Method that initializes the visualization (static content, e.g. SVG area or axes)
 	*/
    initVis() {
        let vis = this;

        vis.data = vis.data.filter(d => d.pedAct)

        // Process data and filter by current year
        vis.processData();

        // Set up year slider
        vis.setupYearSlider();
        
        // Set up play button
        vis.setupPlayButton();

        // Margins and dimensions
		vis.margin = {top: 5, right: 5, bottom: 5, left: 5};
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

        // Initialize xScale (will be updated in updateVis)
        vis.xScale = d3.scaleLinear()
            .range([0, vis.width])
            .domain([0, 1]);
        
        vis.yScale = d3.scaleBand()
            .domain(d3.range(10)) // Always 10 positions: 0, 1, 2, ..., 9
            .range([0, vis.height])
            .padding(0.2);

        // Color scale for pedestrian actions
        vis.colorScale = d3.scaleOrdinal()
            .domain(vis.counts.map(d => d.pedAct))
            .range([
                "#C75B4A", "#66B2B2", "#D9C06B", "#8B4513", "#4A8B6B",
                "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1",
                "#FF9DA7", "#9C755F", "#BAB0AC", "#8DD3C7", "#FDB462",
                "#B3DE69", "#FCCDE5", "#80B1D3", "#BC80BD", "#4E79A7"
            ]);

        vis.updateVis();
        
        // Create dynamic legend
        vis.createLegend();
    }

    /*
     * Create dynamic legend based on actual data
     */
    createLegend() {
        let vis = this;
        
        const legendContainer = d3.select("#legend-container");
        legendContainer.selectAll("*").remove(); // Clear existing legend
        
        // Show top 10 categories
        const allCategories = vis.counts;
        
        // Create a scale for legend positioning that matches the road lanes exactly
        const legendScale = d3.scaleBand()
            .domain(d3.range(10)) // Use same 10 positions as bars
            .range([12, 512]) // Account for road container margins (12px top + 500px road + 12px bottom = 524px total)
            .padding(0.1); // Match the road padding exactly
        
        const legendItems = legendContainer.selectAll(".legend-item")
            .data(allCategories)
            .enter()
            .append("div")
            .attr("class", "legend-item")
            .style("position", "absolute")
            .style("top", (d, i) => legendScale(i) + "px")
            .style("left", "10px")
            .style("right", "10px");
            
        legendItems.append("div")
            .attr("class", "legend-color")
            .style("background-color", d => vis.colorScale(d.pedAct));
            
        legendItems.append("span")
            .attr("class", "legend-text")
            .text(d => d.pedAct);
    }

    /*
     * Create static lane dividers
     */
    createStaticLaneDividers() {
        let vis = this;
        
        // Create exactly 10 lanes (9 dividers between them)
        const laneCount = 10;
        const laneHeight = vis.height / laneCount;
        
        // Create dividers between each lane
        for (let i = 1; i < laneCount; i++) {
            const y = i * laneHeight;
            
            vis.svg.append("line")
                .attr("class", "lane-divider")
                .attr("x1", 0)
                .attr("x2", vis.width)
                .attr("y1", y)
                .attr("y2", y)
                .attr("stroke", "#FFFFFF")
                .attr("stroke-width", 3)
                .attr("stroke-dasharray", "20,20")
                .attr("stroke-dashoffset", i % 2 === 0 ? 0 : 10)
                .attr("opacity", 1);
        }
    }

    /*
     * Process data with cumulative accumulation up to current year
     */
    processData() {
        let vis = this;
        
        // Filter data from 2006 up to current year (cumulative)
        vis.displayData = vis.data.filter(d => {
            // Parse date string like "1/1/2006 10:00:00 AM" to extract year
            const dateStr = d.date;
            const yearMatch = dateStr.match(/\/(\d{4})\s/);
            const year = yearMatch ? parseInt(yearMatch[1]) : new Date(dateStr).getFullYear();
            return year >= 2006 && year <= vis.currentYear;
        });

        // Aggregate counts per pedestrian action (cumulative)
        vis.counts = Array.from(
            d3.rollup(
                vis.displayData,
                v => v.length,
                d => d.pedAct
            ),
            ([pedAct, count]) => ({ pedAct, count })
        );

        // Sort by count (descending) and take top 10
        vis.counts.sort((a, b) => b.count - a.count);
        vis.counts = vis.counts.slice(0, 10); // Always show top 10
    }

    /*
     * Set up year slider functionality
     */
    setupYearSlider() {
        let vis = this;
        
        const yearSlider = document.getElementById('year-slider');
        let currentYearLabel = document.getElementById('current-year');
        if (!currentYearLabel) {
            currentYearLabel = document.querySelector('.marker-label');
        }
        if (!currentYearLabel) {
            currentYearLabel = document.querySelector('#timeline-marker .marker-label');
        }
        const timelineMarker = document.getElementById('timeline-marker');
        
        yearSlider.addEventListener('input', function() {
            vis.currentYear = parseInt(this.value);
            if (currentYearLabel) {
                currentYearLabel.textContent = vis.currentYear;
            }
            
            // Update marker position
            const percentage = ((vis.currentYear - 2006) / (2023 - 2006)) * 100;
            timelineMarker.style.left = percentage + '%';
            
            // Reprocess data and update visualization
            vis.processData();
            vis.updateVis();
            vis.createLegend();
        });
        
        // Set initial year display
        console.log('Setting initial year display:', vis.currentYear);
        console.log('Current year label element:', currentYearLabel);
        if (currentYearLabel) {
            currentYearLabel.textContent = vis.currentYear;
            console.log('Initial year set to:', currentYearLabel.textContent);
        }
    }

    /*
     * Set up play button functionality
     */
    setupPlayButton() {
        let vis = this;
        
        const playButton = document.querySelector('.play-button');
        if (!playButton) return;
        
        playButton.addEventListener('click', () => {
            if (vis.isPlaying) {
                // Stop playing
                vis.stopPlay();
            } else {
                // Start playing
                vis.startPlay();
            }
        });
    }

    /*
     * Start auto-play animation
     */
    startPlay() {
        let vis = this;
        
        vis.isPlaying = true;
        const playButton = document.querySelector('.play-button');
        if (playButton) {
            playButton.classList.add('playing');
        }
        
        // Auto-advance through years
        vis.playInterval = setInterval(() => {
            vis.currentYear++;
            if (vis.currentYear > 2023) {
                vis.currentYear = 2006; // Loop back to start
            }
            
            // Update slider
            const yearSlider = document.getElementById('year-slider');
            if (yearSlider) {
                yearSlider.value = vis.currentYear;
            }
            
            // Update current year display - try multiple selectors
            let currentYearLabel = document.getElementById('current-year');
            if (!currentYearLabel) {
                currentYearLabel = document.querySelector('.marker-label');
            }
            if (!currentYearLabel) {
                currentYearLabel = document.querySelector('#timeline-marker .marker-label');
            }
            
            console.log('Current year label found:', currentYearLabel);
            console.log('Setting year to:', vis.currentYear);
            if (currentYearLabel) {
                currentYearLabel.textContent = vis.currentYear;
                console.log('Year updated to:', currentYearLabel.textContent);
            } else {
                console.log('Current year label not found with any selector!');
            }
            
            // Update visualization
            vis.processData();
            vis.updateVis();
            vis.createLegend();
            
            // Update timeline marker
            const timelineMarker = document.querySelector('.timeline-marker');
            if (timelineMarker) {
                timelineMarker.style.left = `${((vis.currentYear - 2006) / (2023 - 2006)) * 100}%`;
            }
        }, 1000); // 1 second between year changes
    }

    /*
     * Stop auto-play animation
     */
    stopPlay() {
        let vis = this;
        
        vis.isPlaying = false;
        const playButton = document.querySelector('.play-button');
        if (playButton) {
            playButton.classList.remove('playing');
        }
        
        if (vis.playInterval) {
            clearInterval(vis.playInterval);
            vis.playInterval = null;
        }
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
        
        // Update xScale based on current data to ensure bars fit within screen
        const maxCount = d3.max(vis.counts, d => d.count);
        const maxBarWidth = vis.width * 0.95; // Use 95% of available width to prevent overflow
        
        vis.xScale = d3.scaleLinear()
            .range([0, maxBarWidth])
            .domain([0, maxCount]);
        
        // Clear any existing stick figures to prevent duplicates
        vis.svg.selectAll(".bar-icon").remove();
        
        const animationDelay = 50;
        const barCount = vis.counts.length;

        // Create horizontal bars (road lanes)
        const bars = vis.svg.selectAll(".bar")
            .data(vis.counts, d => d.pedAct); 

        const barsEnter = bars.enter().append("rect")
            .attr("class", "bar")
            .attr("x", 0)
            .attr("y", (d, i) => vis.yScale(i)) // Use index (rank)
            .attr("width", 0) // starting at 0 for animation
            .attr("height", vis.yScale.bandwidth())
            .attr("fill", d => vis.colorScale(d.pedAct))
            .attr("rx", 12)
            .attr("ry", 12);

        const barsMerged = barsEnter.merge(bars);

        barsMerged
            .transition()
            .duration(800)
            .ease(d3.easeLinear)
            .attr("width", d => vis.xScale(d.count))
            .attr("y", (d, i) => vis.yScale(i)); // Update y position based on rank

        bars.exit().remove();

        // Add text labels showing accumulated numbers inside each bar
        const labels = vis.svg.selectAll(".bar-label")
            .data(vis.counts, d => d.pedAct);

        const labelsEnter = labels.enter().append("text")
            .attr("class", "bar-label")
            .attr("x", 0) // Start at left edge
            .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
            .attr("text-anchor", "end")
            .attr("dy", "0.35em")
            .style("font-family", "Arial, sans-serif")
            .style("font-size", "12px")
            .style("font-weight", "700")
            .style("fill", "#FFFFFF")
            .style("opacity", 0)
            .text("0"); // Start with 0

        labelsEnter.merge(labels)
            .transition()
            .duration(800)
            .ease(d3.easeLinear)
            .style("opacity", 1)
            .attr("x", d => Math.max(vis.xScale(d.count) - 10, 50)) // Position at right edge with padding, minimum 50px from left
            .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
            .tween("text", function(d) {
                const current = this.textContent.replace(/,/g, '') || 0;
                const target = d.count;
                const interpolator = d3.interpolateNumber(current, target);
                return function(t) {
                    const value = Math.round(interpolator(t));
                    d3.select(this).text(value.toLocaleString());
                };
            });

        labels.exit().remove();

        // Create static lane dividers
        if (!vis.laneDividersCreated) {
            vis.createStaticLaneDividers();
            vis.laneDividersCreated = true;
        }

        // Add walking icons
        const emojiIcons = vis.svg.selectAll(".emoji-icon")
            .data(vis.counts, d => d.pedAct);

        const emojiIconsEnter = emojiIcons.enter().append("text")
            .attr("class", "emoji-icon")
            .attr("x", 0)
            .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
            .attr("text-anchor", "start")
            .attr("dy", "0.35em")
            .style("font-size", "24px")
            .style("opacity", 0)
            .text("🚶‍♀️"); // Walking person emoji

        emojiIconsEnter.merge(emojiIcons)
            .transition()
            .duration(800)
            .ease(d3.easeLinear)
            .style("opacity", 1)
            .attr("x", d => Math.max(vis.xScale(d.count) - 10, 50) + 20) // Position closer to numbers
            .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
            .text("🚶‍♀️"); // Walking person emoji

        emojiIcons.exit().remove();
    }

}