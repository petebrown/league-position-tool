import pandas as pd

results_df = pd.read_csv("https://raw.githubusercontent.com/petebrown/update-results/main/data/results_df.csv", parse_dates=["game_date"])

game_dates = results_df.query("game_type == 'League'")[["season", "game_date", "ssn_comp_game_no"]].rename(columns = {"ssn_comp_game_no": "pld"})

results_mini = pd.read_csv("https://raw.githubusercontent.com/petebrown/league-position-tool/main/docs/input/results_mini.csv").drop(columns = ["ssn_comp_game_no"])

results_mini = results_mini.merge(game_dates, on = ["season", "pld"], how = "left")

results_mini.to_csv("./docs/input/results_mini.csv", index=False)