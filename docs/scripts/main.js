// Set the width and height of the svg canvas
var w = 1000
var h = 500;
var padding = 30;

//Function for converting CSV values from strings to integers
var rowConverter = function(d) {
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
    var season_list = data.filter((seasons) => seasons.gameNo == 1).map((seasons) => seasons.season)

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

			var selected_season = d3.select("#season").node().value;

			var season_data = data.filter((seasons) => seasons.season == selected_season);

			var managers = new Set(season_data.map(d => d.manager));
			var managers = Array.from(managers)
			var nManagers = managers.length;

			var final_game_no = d3.max(season_data, function (d) { return d.gameNo });
			var final_game = season_data.filter((d) => d.gameNo == final_game_no);

			if (selected_season == '2019/20') {
				n_teams = 23;
			} else if (selected_season == '2022/23') {
				n_teams = 24;
			} else {
				n_teams = (final_game[0].gamesPlayed / 2) + 1;
			};

			yTickList = [];
			for (var y_counter = 1; y_counter <= n_teams; ++y_counter) {
				yTickList.push(y_counter)
			  };

			xTickList = [];
			for (var x_counter = 2; x_counter <= final_game_no; x_counter += 2) {
				xTickList.push(x_counter)
			  };

			xScale = d3.scaleLinear()
				.domain([
					d3.min(season_data, function (d) { return d.gameNo; }) - 1,
					d3.max(season_data, function (d) { return d.gameNo; }) + 1,
				])
				.range([padding, w]);
			
			yScale = d3.scaleLinear()
				.domain([
					n_teams + 1,
					0
				])
			   .range([h - padding, 0]);
			   
			//Define axes
			xAxis = d3.axisBottom()
				.scale(xScale)
				// .ticks(final_game_no / 5)
				.tickValues(xTickList)
				.tickFormat(d3.format("d"));

			//Define Y axis
			yAxis = d3.axisLeft()
				.scale(yScale)
				.tickValues(yTickList);

			var line = d3.line()
				.x(function(d) { return xScale(d.gameNo); })
				.y(function(d) { return yScale(d.leaguePosition); });

			var svg = d3.select(".season-chart")
				.append("svg")
				.attr("width", w)
				.attr("height", h);

			//CREATE AXES
			// Create x-axis
			svg.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(0," + (h - padding) + ")")
				.call(xAxis);

			// Create y-axis
			svg.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(" + padding + ",0)")
				.call(yAxis);

			// Calculate average league finish since 1958
			var avPos = d3.mean(season_data, function(d) {return d.leaguePosition; });

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

			d3.select("#season-years")
				.join("span")
				.text(selected_season);

			var league_tier = season_data[0].leagueTier;
			var competition = d3.min(season_data, function (d) { return d.competition; });
			var final_position = final_game[0].leaguePosition;
			var lowest_pos = d3.max(season_data, function (d) { return d.leaguePosition; });
			var highest_pos = d3.min(season_data, function (d) { return d.leaguePosition; });
			var average_position = d3.mean(season_data, function(d) {return d.leaguePosition; }).toFixed(1);

			if (nManagers == 1) {
				managerPhrase = "Manager: " + managers
			} else {
				managerPhrase = "Managers: " + managers.reverse().join(", ")
			}

			if (selected_season == "2022/23") {
				final_position_phrase = "Current Position: " + final_position + "/24"
			} else {
				final_position_phrase = "Final Position: " + final_position + '/' + n_teams
			}
			
			d3.select("#league-tier")
				.join("span")
				.text(league_tier + " (" + competition + ")");
			
			d3.select("#final-position")
				.join("span")
				.text(final_position_phrase);
			
			d3.select("#lowest-position")
				.join("span")
				.text(lowest_pos + '/' + n_teams);
			
			d3.select("#highest-position")
				.join("span")
				.text(highest_pos + '/' + n_teams);
			
			d3.select("#average-position")
				.join("span")
				.text(average_position);

			d3.select("#manager-phrase")
				.join("span")
				.text(managerPhrase)
		})
    }
);