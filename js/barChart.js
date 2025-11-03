
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
        this.initialYear = 2007;
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

        // Set up restart button
        vis.setupRestartButton();

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
        // vis.createLegend();

        // Responsive resize listener
        window.addEventListener('resize', debounce(() => vis.handleResize(), 150));

    }


    // Updated handleResize method
    handleResize() {
        const vis = this;

        // Force reflow before measuring
        const container = document.getElementById(vis.parentElement);
        container.getBoundingClientRect(); // triggers reflow

        // Get *latest* width and height
        vis.width = container.clientWidth - vis.margin.left - vis.margin.right;
        vis.height = container.clientHeight - vis.margin.top - vis.margin.bottom;

        // Update SVG size
        d3.select(`#${vis.parentElement} svg`)
            .attr('width', vis.width + vis.margin.left + vis.margin.right)
            .attr('height', vis.height + vis.margin.top + vis.margin.bottom);

        // Update scales
        vis.xScale.range([0, vis.width]);
        vis.yScale.range([0, vis.height]);

        // Update layout, bars, and labels *without clearing everything*
        vis.laneDividersCreated = false;
        vis.updateVis();

        // Update legend and timeline marker
        // vis.createLegend();
        const timelineMarker = document.getElementById('timeline-marker');
        if (timelineMarker) {
            const percentage = ((vis.currentYear - 2006) / (2023 - 2006)) * 100;
            timelineMarker.style.left = percentage + '%';
        }
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
            // vis.createLegend();
        });
        
        // Set initial year display
        console.log('Setting initial year display:', vis.currentYear);
        console.log('Current year label element:', currentYearLabel);
        if (currentYearLabel) {
            currentYearLabel.textContent = vis.currentYear;
            console.log('Initial year set to:', currentYearLabel.textContent);
        }
    }

    setupRestartButton() {
        let vis = this;
        
        const restartButton = document.querySelector('.restart-button');
        if (!restartButton) {
            console.log('Restart button not found');
            return;
        }
        
        restartButton.addEventListener('click', () => {
            vis.restartTimeline();
        });
        
        console.log('Restart button setup complete');
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
     * Restart timeline to initial year
     */
    restartTimeline() {
        let vis = this;
        
        // Stop auto-play if it's running
        if (vis.isPlaying) {
            vis.stopPlay();
        }
        
        // Reset to initial year
        vis.currentYear = vis.initialYear;
        
        // Update slider
        const yearSlider = document.getElementById('year-slider');
        if (yearSlider) {
            yearSlider.value = vis.currentYear;
        }
        
        // Update current year display
        let currentYearLabel = document.getElementById('current-year');
        if (!currentYearLabel) {
            currentYearLabel = document.querySelector('.marker-label');
        }
        if (!currentYearLabel) {
            currentYearLabel = document.querySelector('#timeline-marker .marker-label');
        }
        
        if (currentYearLabel) {
            currentYearLabel.textContent = vis.currentYear;
        }
        
        // Update timeline marker position
        const timelineMarker = document.querySelector('.timeline-marker');
        if (timelineMarker) {
            timelineMarker.style.left = `${((vis.currentYear - 2006) / (2023 - 2006)) * 100}%`;
        }
        
        // Reprocess data and update visualization
        vis.processData();
        vis.updateVis();
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
            // vis.createLegend();
            
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
    
    // Update xScale based on current data
    const maxCount = d3.max(vis.counts, d => d.count);
    const maxBarWidth = vis.width * 0.75; // Use 75% of available width to leave more space for labels
    
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
        .attr("y", (d, i) => vis.yScale(i))
        .attr("width", 0)
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
        .attr("y", (d, i) => vis.yScale(i));

    bars.exit().remove();

    // Add text labels showing accumulated numbers inside each bar
    const labels = vis.svg.selectAll(".bar-label")
        .data(vis.counts, d => d.pedAct);

    const labelsEnter = labels.enter().append("text")
        .attr("class", "bar-label")
        .attr("x", 0)
        .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
        .attr("text-anchor", "end")
        .attr("dy", "0.35em")
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("fill", "#FFFFFF")
        .style("opacity", 0)
        .text("0");

    labelsEnter.merge(labels)
        .transition()
        .duration(800)
        .ease(d3.easeLinear)
        .style("opacity", 1)
        .attr("x", d => Math.max(vis.xScale(d.count) - 10, 50))
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

    // Add legend labels at the far right of the chart area
    const legendLabels = vis.svg.selectAll(".legend-label")
        .data(vis.counts, d => d.pedAct);

    const legendLabelsEnter = legendLabels.enter().append("text")
        .attr("class", "legend-label")
        .attr("x", vis.width - 10) // Position at far right with 10px padding
        .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
        .attr("text-anchor", "end") // Right-align text
        .attr("dy", "0.35em")
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "12px")
        .style("font-weight", "400")
        .style("fill", "#C75B4A")
        .style("opacity", 0)
        .text(d => d.pedAct);

    legendLabelsEnter.merge(legendLabels)
        .transition()
        .duration(800)
        .ease(d3.easeLinear)
        .style("opacity", 1)
        .attr("x", vis.width - 10) // Fixed position at far right
        .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
        .text(d => d.pedAct);

    legendLabels.exit().remove();

    // Create static lane dividers
    if (!vis.laneDividersCreated) {
        vis.svg.selectAll(".lane-divider").remove();
        vis.createStaticLaneDividers();
        vis.laneDividersCreated = true;
    }

    // Add walking icons - position them closer to the numbers
    const emojiIcons = vis.svg.selectAll(".emoji-icon")
        .data(vis.counts, d => d.pedAct);

    const emojiIconsEnter = emojiIcons.enter().append("text")
        .attr("class", "emoji-icon")
        .attr("x", 0)
        .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
        .attr("text-anchor", "start")
        .attr("dy", "0.35em")
        .style("font-size", "20px") // Slightly smaller to fit better
        .style("opacity", 0)
        .text("🚶‍♀️");

    emojiIconsEnter.merge(emojiIcons)
        .transition()
        .duration(800)
        .ease(d3.easeLinear)
        .style("opacity", 1)
        .attr("x", d => Math.max(vis.xScale(d.count) - 10, 50) + 15)
        .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
        .text("🚶‍♀️");

    emojiIcons.exit().remove();
    }
}


function debounce(func, wait) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(func, wait);
  };
}