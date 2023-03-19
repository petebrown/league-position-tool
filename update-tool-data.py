import undetected_chromedriver as uc
import pandas as pd
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.core.utils import ChromeType
from selenium.webdriver.chrome.service import Service
import logging

chrome_service = Service(ChromeDriverManager(chrome_type=ChromeType.CHROMIUM, version="111.0.5563.64").install())

chrome_options = uc.ChromeOptions()
options = [
    "--headless",
    "--disable-gpu",
    "--window-size=1920,1200",
    "--ignore-certificate-errors",
    "--disable-extensions",
    "--no-sandbox",
    "--disable-dev-shm-usage"
]
for option in options:
    chrome_options.add_argument(option)

driver = uc.Chrome(service=chrome_service, options=chrome_options)

# Read in the current CSV and find the game number of the latest game it contains
current_df = pd.read_csv("./docs/input/results_mini.csv")
latest_game_no = current_df[(current_df.season == current_df.season.max())].ssn_comp_game_no.max()

# Read in the season's full fixture list
fixtures = pd.read_csv("./data/fixtures.csv", parse_dates=["game_date"])
# Get today's date
today = pd.Timestamp("today")

# Filter the fixture list to find the game number of the most recent league game
latest_fixture = fixtures[fixtures.game_date <= today].ssn_comp_game_no.max()

# # Filter the fixture list to find the games to be added to current_df
dates_to_get = fixtures[(fixtures.ssn_comp_game_no > latest_game_no) & (fixtures.ssn_comp_game_no <= latest_fixture)].copy()

if dates_to_get.empty:
    print("No Updates!")
else:
    dates_to_get = dates_to_get.sort_values("ssn_comp_game_no", ascending=False)

    # Find the day, month and year of missing fixture to help construct the 11v11 URL
    dates_to_get["day"] = dates_to_get.game_date.dt.day
    dates_to_get["month"] = dates_to_get.game_date.dt.month_name().str.lower()
    dates_to_get["year"] = dates_to_get.game_date.dt.year

    # Construct the league table URL(s) to be scraped
    def construct_url(day, month, year):
        day = int(day)
        if day < 10:
            day = f'0{day}'
        url = f"https://www.11v11.com/league-tables/league-two/{day}-{month}-{year}/"
        return url

    # Add URLs to be scraped to dataframe and save as a list
    dates_to_get['table_url'] = dates_to_get.apply(lambda row: construct_url(row.day, row.month, row.year), axis=1)

    update_urls = dates_to_get.table_url.to_list()

    updates_df = pd.DataFrame()

    # Scrape league table for each date
    for url in update_urls:
        try:    
            driver.get(url)

            doc = driver.page_source
            table = pd.read_html(doc)[0]
            df = pd.DataFrame(table)
            df = df[['Pos', 'Team', 'Pld', 'W', 'D', 'L', 'GF', 'GA', 'Pts']]
            df['index_no'] = df.index + 1
            df['url'] = url
            updates_df = pd.concat([updates_df, df])
        except:
            logging.basicConfig(filename='error.log', encoding='utf-8', level=logging.DEBUG)
            logging.warning('Failed trying to scrape %s', url)

    try:
        updates_df.Pos = updates_df.Pos.astype(str).str.replace("doRowNumer();", "", regex=False)
    except AttributeError:
        pass

    updates_df.columns = updates_df.columns.str.lower()
    updates_df.url = updates_df.url.str.replace("/\n", "", regex=False)
    updates_df['date'] = updates_df.url.str.split("/", regex=False).str[5].str.replace("-", " ")
    updates_df.date = pd.to_datetime(updates_df.date)
    updates_df['gd'] = updates_df.gf - updates_df.ga
    updates_df['g_av'] = updates_df.gf / updates_df.ga
    updates_df['pts_and_goals'] = updates_df[["pts", "gd", "gf"]].apply(tuple, axis=1)
    updates_df['ranking'] = updates_df.groupby("url").pts_and_goals.rank("min", ascending=False)

    updates_df = updates_df[["date", "pos", "ranking", "team", "pld", "w", "d", "l", "gf", "ga", "gd", "g_av", "pts"]]

    trfc = updates_df[updates_df.team == 'Tranmere Rovers'].drop(["pos", "team"], axis=1).rename(columns = {"date": "game_date"})
    results = pd.read_csv("https://raw.githubusercontent.com/petebrown/update-results/main/data/results_df.csv", parse_dates=["game_date"])
    new_results = results.merge(trfc, on="game_date")
    new_results = new_results.drop(['home_team',
        'away_team',
        'home_goals',
        'away_goals',
        'secondary_score',
        'source_url',
        'stadium',
        'game_type'], axis=1)
    new_results_mini = new_results[['season', 'competition', 'league_tier', 'ssn_comp_game_no', 'ranking', 'pld', 'pts', 'manager']]

    updated_results_mini = pd.concat([new_results_mini, current_df])
    updated_results_mini = updated_results_mini.drop_duplicates(ignore_index=True)

    updated_results_mini.to_csv("./docs/input/results_mini.csv", index=False)

driver.quit()
