
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
        this.currentYear = 2007; 
        this.laneDividersCreated = false;
        this.isPlaying = false;
        this.playInterval = null;
        this.initialYear = 2006;
        this.filterState = { severity: 'all', pedAct: 'all', district: 'all', pedAge: 'all' };
    }

    /*
	 * Method that initializes the visualization (static content, e.g. SVG area or axes)
 	*/
    initVis() {
        let vis = this;

        vis.data = vis.data.filter(d => d.pedAct)

        // Process data and filter by current year
        vis.processData();

        // Set up year slider, control buttons, and filters
        vis.setupYearSlider();
        vis.setupPlayButton();
        vis.setupRestartButton();
        vis.bindTileFilters();
        vis.setupDropdownFilters();

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
            .padding(0.1);

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
        
        // Responsive resize listener to handle window size changes
        window.addEventListener('resize', debounce(() => vis.handleResize(), 150));
    }

    /*
	 * Method that resizes visualization elements based on window size changes
 	*/
    handleResize() {
        const vis = this;

        // Force reflow before measuring
        const container = document.getElementById(vis.parentElement);
        container.getBoundingClientRect(); // triggers reflow

        // Get updated width and height
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
        const timelineMarker = document.getElementById('timeline-marker');
        if (timelineMarker) {
            const percentage = ((vis.currentYear - 2006) / (2023 - 2006)) * 100;
            timelineMarker.style.left = percentage + '%';
        }
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
        // severity filter
        if (vis.filterState.severity === 'fatal') {
            vis.displayData = vis.displayData.filter(d => d.severity === 'fatal');
        } else if (vis.filterState.severity === 'nonfatal') {
            vis.displayData = vis.displayData.filter(d => d.severity === 'nonfatal');
        }

        // pedestrian action filter
        if (vis.filterState.pedAct !== 'all' && Array.isArray(vis.filterState.pedAct) && vis.filterState.pedAct.length > 0) {
            vis.displayData = vis.displayData.filter(d => vis.filterState.pedAct.includes(d.pedAct));
        }

        // district filter
        if (vis.filterState.district !== 'all' && Array.isArray(vis.filterState.district) && vis.filterState.district.length > 0) {
            vis.displayData = vis.displayData.filter(d => vis.filterState.district.includes(d.district));
        }

        // pedestrian age filter
        if (vis.filterState.pedAge !== 'all' && Array.isArray(vis.filterState.pedAge) && vis.filterState.pedAge.length > 0) {
            vis.displayData = vis.displayData.filter(d => vis.filterState.pedAge.includes(d.pedAge));
        }

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

    /* Timeline related methods --------------------------------------------------------------------------------- */

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
     * Set up restart button functionality
     */
    setupRestartButton() {
        let vis = this;
        
        const restartButton = document.querySelector('.restart-button');
        if (!restartButton) return;
        
        restartButton.addEventListener('click', () => {
            vis.restartTimeline();
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

    /* Filter related methods --------------------------------------------------------------------------------- */

    /*
     * Applies severity filter to the data
     */
    bindTileFilters() {
        const vis = this;
        const bar = document.getElementById('filter-bar');
        if (!bar) return;

        bar.addEventListener('click', (e)=>{
            const btn = e.target.closest('.tile');
            if (!btn) return;
            const groupEl = btn.closest('.tile-group');
            const group = groupEl?.getAttribute('data-group');
            const value = btn.getAttribute('data-value');
            if (!group || !value) return;

            // single-select per group
            groupEl.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');

            if (group === 'severity') vis.filterState.severity = value;

            vis.processData();
            vis.updateVis();
        });
    }

    /*
     * Set up dropdown filters for pedestrian action and district
     */
    setupDropdownFilters() {
        let vis = this;

        // Get unique values
        const uniquePedActs = [...new Set(vis.data.map(d => d.pedAct).filter(d => d))].sort();
        const uniqueDistricts = [...new Set(vis.data.map(d => d.district).filter(d => d))].sort();

        // Setup pedestrian action filter
        setupFilter('pedAct', uniquePedActs, vis);
        
        // Setup district filter
        setupFilter('district', uniqueDistricts, vis);

        // Setup pedestrian age filter
        const uniquePedAges = [...new Set(vis.data.map(d => d.pedAge).filter(d => d))].sort();
        setupFilter('pedAge', uniquePedAges, vis);
    }

    /* Tooltip related methods --------------------------------------------------------------------------------- */

    /*
    * Calculate tooltip data for a specific pedestrian action
    */
    calculateTooltipData(pedAct) {
        let vis = this;
        
        // Get current year data for this pedestrian action
        const currentYearData = vis.displayData.filter(d => d.pedAct === pedAct);
        const currentCount = currentYearData.length;
        
        // Calculate previous year data
        const previousYear = vis.currentYear - 1;
        const previousYearData = vis.data.filter(d => {
            const dateStr = d.date;
            const yearMatch = dateStr.match(/\/(\d{4})\s/);
            const year = yearMatch ? parseInt(yearMatch[1]) : new Date(dateStr).getFullYear();
            return year === previousYear && d.pedAct === pedAct;
        });
        const previousCount = previousYearData.length;
        
        // Calculate increase from previous year
        let increase = currentCount - previousCount;
        let increasePercentage = previousCount > 0 ? ((increase / previousCount) * 100) : (currentCount > 0 ? 100 : 0);
        
        // Calculate percentage among other pedestrian actions for current year
        const totalCurrentYear = vis.displayData.length;
        const percentage = totalCurrentYear > 0 ? ((currentCount / totalCurrentYear) * 100) : 0;
        
        // Find most common month
        const monthCounts = {};
        currentYearData.forEach(d => {
            const dateStr = d.date;
            const monthMatch = dateStr.match(/(\d{1,2})\/\d{1,2}\/(\d{4})/);
            if (monthMatch) {
                const month = parseInt(monthMatch[1]);
                monthCounts[month] = (monthCounts[month] || 0) + 1;
            }
        });
        
        let mostCommonMonth = "N/A";
        let maxMonthCount = 0;
        Object.entries(monthCounts).forEach(([month, count]) => {
            if (count > maxMonthCount) {
                maxMonthCount = count;
                mostCommonMonth = this.getMonthName(parseInt(month));
            }
        });

        // District concentration
        const districtCounts = {};
        currentYearData.forEach(d => {
            if (d.district) {
                districtCounts[d.district] = (districtCounts[d.district] || 0) + 1;
            }
        });
        
        // Sort districts by count (descending)
        const sortedDistricts = Object.entries(districtCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3); // Get top 3 districts
        
        // Calculate concentration metrics
        const topDistrict = sortedDistricts[0] ? sortedDistricts[0][0] : "N/A";
        const topDistrictCount = sortedDistricts[0] ? sortedDistricts[0][1] : 0;
        const topDistrictPercentage = currentCount > 0 ? ((topDistrictCount / currentCount) * 100).toFixed(1) : 0;
        
        // Calculate top 3 districts concentration
        const top3Total = sortedDistricts.reduce((sum, district) => sum + district[1], 0);
        const top3Percentage = currentCount > 0 ? ((top3Total / currentCount) * 100).toFixed(1) : 0;
        
        return {
            pedAct: pedAct,
            currentCount: currentCount,
            previousCount: previousCount,
            increase: increase,
            increasePercentage: increasePercentage,
            percentage: percentage,
            mostCommonMonth: mostCommonMonth,
            topDistrict: topDistrict,
            topDistrictPercentage: topDistrictPercentage,
            topDistrictCount: topDistrictCount,
            top3Districts: sortedDistricts,
            top3Percentage: top3Percentage
        };
    }

    /*
    * Convert month number to month name
    */
    getMonthName(month) {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        return months[month - 1] || "Unknown";
    }

    /*
	* The drawing function - should use the D3 update sequence (enter, update, exit)
 	* Function parameters only needed if different kinds of updates are needed
 	*/
    updateVis(){
        const vis = this;
        
        // Update xScale based on current data
        const maxCount = d3.max(vis.counts, d => d.count);
        const maxBarWidth = vis.width * 0.75;
        
        vis.xScale = d3.scaleLinear()
            .range([0, maxBarWidth])
            .domain([0, maxCount]);
        
        // Clear any existing stick figures to prevent duplicates
        vis.svg.selectAll(".bar-icon").remove();
        
        // Create/update tooltip div
        let tooltip = d3.select("body").selectAll(".tooltip").data([0]);
        tooltip = tooltip.enter()
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .merge(tooltip);

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

        // Add tooltip interactions to bars
        barsMerged
            .on("mouseover", function(event, d) {
                const tooltipData = vis.calculateTooltipData(d.pedAct);
                
                // Clear existing tooltip content
                tooltip.html("");
                
                // Build tooltip content using D3
                tooltip.append('div')
                    .attr('class', 'tooltip-title')
                    .text(tooltipData.pedAct);
                
                // Current year total
                const item1 = tooltip.append('div')
                    .attr('class', 'tooltip-item');
                
                item1.append('span')
                    .attr('class', 'tooltip-label')
                    .text('Current Year Total:');
                
                item1.append('span')
                    .attr('class', 'tooltip-value')
                    .text(tooltipData.currentCount.toLocaleString());

                // Percentage of total
                const item3 = tooltip.append('div')
                    .attr('class', 'tooltip-item');
                
                item3.append('span')
                    .attr('class', 'tooltip-label')
                    .text('Percentage of Total:');
                
                item3.append('span')
                    .attr('class', 'tooltip-value')
                    .text(`${tooltipData.percentage.toFixed(1)}%`);
                
                // Change from previous year
                const item2 = tooltip.append('div')
                    .attr('class', 'tooltip-item');
                
                const previousYearText = tooltipData.previousCount > 0 ? 
                    `Change from ${vis.currentYear - 1}:` : 
                    'Change from previous year:';
                
                const increaseClass = tooltipData.increase > 0 ? 'tooltip-positive' : 
                                    tooltipData.increase < 0 ? 'tooltip-negative' : 'tooltip-neutral';
                const increaseSign = tooltipData.increase > 0 ? '+' : '';
                
                item2.append('span')
                    .attr('class', 'tooltip-label')
                    .text(previousYearText);
                
                item2.append('span')
                    .attr('class', `tooltip-value ${increaseClass}`)
                    .text(`${increaseSign}${tooltipData.increase} (${increaseSign}${tooltipData.increasePercentage.toFixed(1)}%)`);
                
                
                // Most common month
                const item4 = tooltip.append('div')
                    .attr('class', 'tooltip-item');
                
                item4.append('span')
                    .attr('class', 'tooltip-label')
                    .text('Most Common Month:');
                
                item4.append('span')
                    .attr('class', 'tooltip-value')
                    .text(tooltipData.mostCommonMonth);
                
                tooltip
                    .style("opacity", 1)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");

                // Top districts
                if (tooltipData.top3Districts.length > 1) {
                    const itemTop3 = tooltip.append('div')
                        .attr('class', 'tooltip-item')
                        .style('flex-direction', 'column')
                        .style('align-items', 'flex-start');
                    
                    itemTop3.append('span')
                        .attr('class', 'tooltip-label')
                        .text('District Concentration:');
                    
                    // Add each top district
                    tooltipData.top3Districts.forEach((district, index) => {
                        const districtPercentage = ((district[1] / tooltipData.currentCount) * 100).toFixed(1);
                        const districtItem = itemTop3.append('div')
                            .attr('class', 'tooltip-district-item')
                            .style('display', 'flex')
                            .style('justify-content', 'space-between')
                            .style('width', '100%')
                            .style('font-size', '11px')
                            .style('margin-top', '2px');
                        
                        districtItem.append('span')
                            .attr('class', 'tooltip-label')
                            .style('font-weight', 'normal')
                            .text(`${index + 1}. ${district[0]}`);
                        
                        districtItem.append('span')
                            .attr('class', 'tooltip-value')
                            .style('font-weight', 'normal')
                            .text(`${district[1]} (${districtPercentage}%)`);
                    });
                }
                
                // Highlight the bar
                d3.select(this)
                    .attr("stroke", "#C75B4A")
                    .attr("stroke-width", 2);
            })
            .on("mouseout", function() {
                // Remove tooltip when not hovering on bar
                tooltip.style("opacity", 0);
                d3.select(this)
                    .attr("stroke", null)
                    .attr("stroke-width", null);
            });

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
            .attr("x", d => Math.max(vis.xScale(d.count) - 5, 5))
            .attr("text-anchor", "end")
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
            .attr("x", vis.width - 10)
            .attr("y", (d, i) => vis.yScale(i) + vis.yScale.bandwidth()/2)
            .attr("text-anchor", "end")
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
            .attr("x", vis.width - 10)
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
            .style("font-size", "20px")
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

/* 
* Clears and resets timeout (debuff time to resize window) 
*/
function debounce(func, wait) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(func, wait);
  };
}

/*
* Simple filter setup function using D3 patterns
*/
function setupFilter(filterType, options, vis) {
    // Prepare data: add "All" option first
    let filterData = [{value: 'all', label: 'All', checked: true}];
    options.forEach(opt => {
        filterData.push({value: opt, label: opt, checked: false});
    });

    // Select container
    let container = d3.select(`#${filterType}-checkboxes`);
    if (container.empty()) return;

    // Bind data and create checkboxes using D3 pattern
    let items = container.selectAll(".filter-checkbox-item")
        .data(filterData);

    // Enter: create new items
    let itemsEnter = items.enter()
        .append("div")
        .attr("class", "filter-checkbox-item");

    // Append checkbox and label
    itemsEnter.append("input")
        .attr("type", "checkbox")
        .attr("id", d => `${filterType}-${d.value === 'all' ? 'all' : d.value.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`)
        .attr("value", d => d.value)
        .property("checked", d => d.checked);

    itemsEnter.append("label")
        .attr("for", d => `${filterType}-${d.value === 'all' ? 'all' : d.value.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`)
        .text(d => d.label);

    // Merge enter and update
    let itemsMerged = itemsEnter.merge(items);

    // Update checkboxes
    itemsMerged.select("input")
        .property("checked", d => d.checked);

    // Handle checkbox changes
    container.on("change", function(event) {
        let allCheckbox = d3.select(`#${filterType}-all`);
        let checkboxes = container.selectAll(`input:not(#${filterType}-all)`);
        let clicked = event.target;

        if (clicked.id === `${filterType}-all`) {
            // If "All" is checked, uncheck all others
            if (d3.select(clicked).property("checked")) {
                checkboxes.property("checked", false);
                vis.filterState[filterType] = 'all';
            }
        } else {
            // If any other checkbox is checked, uncheck "All"
            if (d3.select(clicked).property("checked")) {
                allCheckbox.property("checked", false);
            }
            
            // Get selected values
            let selected = checkboxes.nodes()
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            
            // If nothing selected, select "All"
            if (selected.length === 0) {
                allCheckbox.property("checked", true);
                vis.filterState[filterType] = 'all';
            } else {
                vis.filterState[filterType] = selected;
            }
        }
        
        updateFilterButtonText(filterType, vis.filterState[filterType] === 'all' ? 0 : vis.filterState[filterType].length, vis);
        vis.processData();
        vis.updateVis();
    });

    // Setup button toggle
    d3.select(`#${filterType}-filter-btn`)
        .on("click", function(event) {
            event.stopPropagation();
            let isVisible = container.style("display") === "flex";
            container.style("display", isVisible ? "none" : "flex");
            // Close other filter
            let otherType = filterType === 'pedAct' ? 'district' : 'pedAct';
            d3.select(`#${otherType}-checkboxes`).style("display", "none");
        });

    // Close dropdowns when clicking outside
    d3.select("body").on("click", function(event) {
        if (!event.target.closest('.filter-dropdown-group')) {
            container.style("display", "none");
            d3.select(`#${filterType === 'pedAct' ? 'district' : 'pedAct'}-checkboxes`).style("display", "none");
        }
    });
}

/*
* Simple function to update filter button text
*/
function updateFilterButtonText(filterType, count, vis) {
    let button = d3.select(`#${filterType}-filter-btn`);
    
    if (button.empty()) return;

    let baseText;
    
    // Determine filter label
    if (filterType === 'pedAct') {
        baseText = 'Pedestrian Action';
    } else if (filterType === 'district') {
        baseText = 'District';
    } else if (filterType === 'pedAge') {
        baseText = 'Pedestrian Age';
    } else if (filterType === 'severity') {
        baseText = 'Severity';
    } else {
        baseText = filterType;
    }

    // Check if all values are selected
    let isAll = vis.filterState[filterType] === 'all';
    
    // Update label text
    button.select("span")
        .text(isAll ? baseText : (count > 0 ? `${baseText} (${count})` : baseText));
}