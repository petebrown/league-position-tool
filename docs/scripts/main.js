// Set the width and height of the svg canvas
let w = 1000
let h = 500;
let padding = 37;

//Function for converting CSV values from strings to integers
let rowConverter = function(d) {
	return {
		season: d.season,
		leagueTier: parseInt(d.league_tier),
		competition: d.competition,
		gameNo: parseInt(d.ssn_comp_game_no),
		leaguePosition: parseInt(d.ranking),
		gamesPlayed: parseInt(d.pld),
		points: parseInt(d.pts),
		manager: d.manager
	};
};

// Load the seasons CSV
d3.csv("./input/results_mini.csv", rowConverter)
	.then((data) => {

    // Get the list of seasons
    let season_list = data.filter((seasons) => seasons.gameNo == 1).map((seasons) => seasons.season);

	// Populate drop-down with list of seasons
	d3.select("#season")
		.selectAll("option.opt")
		.data(season_list)
		.join("option")
		.attr("class", "opt")
		.attr("value", (d) => d)
		.text((d) => d);

	// Select the button
	d3.select("button")
		// give it a click event listener
		.on("click", () => {
			d3.select(".season-overview").classed("hide", false);
			
			d3.select(".season-chart svg").remove();

			let selected_season = d3.select("#season").node().value;

			let season_data = data.filter((seasons) => seasons.season == selected_season);

			let managers = new Set(season_data.map(d => d.manager));
			let managersArray = Array.from(managers);
			let nManagers = managersArray.length;

			let final_game_no = d3.max(season_data, function (d) { return d.gameNo });
			let final_game = season_data.filter((d) => d.gameNo == final_game_no);

			if (selected_season == '2019/20') {
				n_teams = 23;
			} else if (selected_season == '2022/23') {
				n_teams = 24;
			} else {
				n_teams = (final_game[0].gamesPlayed / 2) + 1;
			};

			let totalPoints = d3.max(season_data, function (d) { return d.points });
			
			let yTickList = [];
			for (let y_counter = 1; y_counter <= n_teams; ++y_counter) {
				yTickList.push(y_counter)
			  };

			let xTickList = [];
			for (let x_counter = 2; x_counter <= final_game_no; x_counter += 2) {
				xTickList.push(x_counter)
			  };

			let xScale = d3.scaleLinear()
				.domain([
					d3.min(season_data, function (d) { return d.gameNo; }) - 1,
					d3.max(season_data, function (d) { return d.gameNo; }) + 1,
				])
				.range([padding, w]);
			
			let yScale = d3.scaleLinear()
				.domain([
					n_teams + 1,
					0
				])
			   .range([h - padding, 0]);
			   
			//Define axes
			let xAxis = d3.axisBottom()
				.scale(xScale)
				.tickValues(xTickList)
				.tickFormat(d3.format("d"));

			//Define Y axis
			let yAxis = d3.axisLeft()
				.scale(yScale)
				.tickValues(yTickList);

			let line = d3.line()
				.x(function(d) { return xScale(d.gameNo); })
				.y(function(d) { return yScale(d.leaguePosition); });

			let svg = d3.select(".season-chart")
				.append("svg")
				.attr("viewBox", `0 0 1000 500`)
				.attr("preserveAspectRatio", "xMidYMid meet")

			//CREATE AXES
			// Create x-axis
			svg.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(0," + (h - padding) + ")")
				.call(xAxis);

			 // text label for the x axis
			svg.append("text")
				.attr("class", "axis-text")
				.attr("transform", "translate(" + (w / 2) + " ," + (h - 2) + ")")
				.text("Game number");

			// Create y-axis
			svg.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(" + padding + ",0)")
				.call(yAxis);

			// text label for the y axis
			svg.append("text")
				.attr("class", "axis-text")
				.attr("transform", "rotate(-90)")
				.attr("y", "1")
				.attr("x", 0 - (h / 2))
				.attr("dy", "1em")
				.text("League position");

			// Calculate average league finish since 1958
			let avPos = d3.mean(season_data, function(d) {return d.leaguePosition; });

			// Add line for average position since 1958
			svg.append("line")
				.attr("class", "line avPosition")
				.attr("x1", padding)
				.attr("x2", w)
				.attr("y1", yScale(avPos))
				.attr("y2", yScale(avPos));

			// Draw line joining league positions
			svg.append("path")
				.datum(season_data)
				.attr("class", "line")
				.attr("d", line);

			// Generate circles last, so they appear in front
			svg.selectAll("circle")
				.data(season_data)
				.enter()
				.append("circle")
				.attr("cx", function(d) {
						return xScale(d.gameNo);
				})
				.attr("cy", function(d) {
						return yScale(d.leaguePosition);
				})
				.attr("r", 2.5);

			// Display season-specific text for season_overview div
			d3.select("#season-years")
				.join("span")
				.text(selected_season);

			let league_tier = season_data[0].leagueTier;
			let competition = d3.min(season_data, function (d) { return d.competition; });
			let final_position = final_game[0].leaguePosition;
			let lowest_pos = d3.max(season_data, function (d) { return d.leaguePosition; });
			let highest_pos = d3.min(season_data, function (d) { return d.leaguePosition; });
			let average_position = d3.mean(season_data, function(d) {return d.leaguePosition; }).toFixed(1);
			let avPoints = (totalPoints / final_game_no).toFixed(2);

			let managerPhrase1;
			let managerPhrase2;
			if (nManagers == 1) {
				managerPhrase1 = "Manager: "
				managerPhrase2 = managersArray
			} else {
				managerPhrase1 = "Managers: "
				managerPhrase2 = managersArray.reverse().join(", ")
			}

			let final_position_phrase1;
			let final_position_phrase2;
			if (selected_season == "2022/23") {
				final_position_phrase1 = "Current Position: "
				final_position_phrase2 = final_position + "/24"
			} else {
				final_position_phrase1 = "Final Position: "
				final_position_phrase2 = final_position + '/' + n_teams
			}
			
			d3.select("#league-tier")
				.join("span")
				.text(league_tier + " (" + competition + ")");
			
			d3.select("#final-position-1")
				.join("span")
				.text(final_position_phrase1);
			
			d3.select("#final-position-2")
				.join("span")
				.text(final_position_phrase2);
			
			d3.select("#lowest-position")
				.join("span")
				.text(lowest_pos + '/' + n_teams);
			
			d3.select("#highest-position")
				.join("span")
				.text(highest_pos + '/' + n_teams);
			
			d3.select("#average-position")
				.join("span")
				.text(average_position);

			d3.select("#final-points")
				.join("span")
				.text(totalPoints)

			d3.select("#average-points")
				.join("#span")
				.text(avPoints)

			d3.select("#manager-phrase-1")
				.join("span")
				.attr("class", "bold")
				.text(managerPhrase1)

			d3.select("#manager-phrase-2")
				.join("span")
				.text(managerPhrase2)
				
		})
    }
);