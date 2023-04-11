import requests
from bs4 import BeautifulSoup
import pandas as pd

def get_current_df():
    current_df = pd.read_csv("./docs/input/results_mini.csv", parse_dates=["game_date"])
    return current_df

def get_max_date_in_df(df):
    latest_game_date = df.game_date.max()
    return latest_game_date

def get_html(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
        }
    r = requests.get(url, headers=headers)
    html = r.text
    return html

def get_match_list(html):
    match_list = pd.read_html(html, parse_dates=["Date"])[0]
    return match_list

def clean_match_list(match_list):
    match_list.columns = match_list.columns.str.lower()
    match_list = match_list.rename(columns = {"date": "game_date"})
    match_list.game_date = match_list.game_date.dt.normalize()
    return match_list

def filter_match_list_to_league_two(match_list):
    league_games = match_list[match_list.competition == "League Two"].reset_index(drop=True)
    return league_games

def filter_played_games(match_list):
    played_games = match_list[match_list.result.notnull()].reset_index(drop=True)
    return played_games

def filter_missing_matches(match_list, df_max_date):
    latest_game_date = match_list.game_date.max()
    if latest_game_date > df_max_date:
        new_matches = match_list[match_list.game_date > df_max_date].reset_index(drop=True)
        return new_matches
    else:
        return None

def construct_url(date):
    day = f"{date.day:02d}"
    month = date.month_name().lower()
    year = f"{date.year:04d}"

    url = f"https://www.11v11.com/league-tables/league-two/{day}-{month}-{year}/"
    return url

def add_urls_to_new_matches(new_matches):
    new_matches["url"] = new_matches.game_date.apply(construct_url)
    return new_matches

def get_urls_to_scrape(new_matches):
    urls_to_scrape = new_matches.url.to_list()
    return urls_to_scrape

def scrape_league_table(url):
    html = get_html(url)
    league_table = pd.read_html(html)[0]
    league_table["url"] = url
    return league_table

def clean_league_table(league_table):
    league_table.columns = league_table.columns.str.lower()
    league_table['gd'] = league_table.gf - league_table.ga
    league_table['pts_and_goals'] = league_table[["pts", "gd", "gf"]].apply(tuple, axis=1)
    league_table['ranking'] = league_table.groupby("url").pts_and_goals.rank("min", ascending=False)

    league_table = league_table.query("team == 'Tranmere Rovers'")

    league_table = league_table[["url", "ranking", "pld", "pts"]].reset_index(drop=True)

    return league_table

def get_manager_df():
    managers_df = pd.read_html("https://www.soccerbase.com/teams/team.sd?team_id=2598&teamTabs=managers")[1].rename(columns = 
    {
        "Unnamed: 0": "manager_name",
        "FROM": "manager_start_date",
        "TO": "manager_end_date"
        })
    managers_df.manager_start_date = pd.to_datetime(managers_df.manager_start_date)
    managers_df.manager_end_date = managers_df.apply(lambda x: pd.to_datetime("today") if x.manager_end_date == "Present" else pd.to_datetime(x.manager_end_date), axis=1)
    return managers_df

def find_manager_on_date(input_date):
    managers_df = get_manager_df()
    input_date = pd.Timestamp(input_date)
    try:
        manager_index = managers_df.apply(lambda x : (input_date >= x.manager_start_date) & (input_date <= x.manager_end_date), axis = 1)
        manager = managers_df[manager_index].manager_name
        manager = manager.squeeze()
    except:
        manager = 'Unknown'
    return manager

def add_manager_to_df(df):
    df["manager"] = df.game_date.apply(find_manager_on_date)
    return df

def map_league_tier_to_comp(competition):
    league_tiers = {
        'National League': 5,
        'Football Conference Play-off': 5,
        'League Two': 4,
        'League Two Play-Offs': 4,
        'League One': 3,
        'League One Play-Offs': 3
    }
    league_tier = league_tiers[competition]
    return league_tier

def add_league_tier_to_df(df):
    df["league_tier"] = df.competition.apply(map_league_tier_to_comp)
    return df

def add_season_to_df(df, season_text):
    df["season"] = season_text
    return df

def manually_update_manager(df):
    df.loc[df.game_date > pd.to_datetime("2023-03-19").date(), "manager"] = "Ian Dawes"
    return df

current_df = get_current_df()  

df_max_date = get_max_date_in_df(current_df)

url = "https://www.11v11.com/teams/tranmere-rovers/tab/matches"

html = get_html(url)
doc = BeautifulSoup(html, "html.parser")
season_text = doc.select_one("ul#season li.active a").text.replace("-", "/")
ssn_match_list = get_match_list(html)
ssn_match_list = clean_match_list(ssn_match_list)
ssn_match_list = filter_match_list_to_league_two(ssn_match_list)
ssn_match_list = filter_played_games(ssn_match_list)

new_matches = filter_missing_matches(ssn_match_list, df_max_date)

if new_matches.empty:
    print("No new matches found")
else:
    new_matches = add_urls_to_new_matches(new_matches)
    new_matches = add_league_tier_to_df(new_matches)
    new_matches = add_manager_to_df(new_matches)
    new_matches = add_season_to_df(new_matches, season_text)

    urls_to_scrape = get_urls_to_scrape(new_matches)

    league_tables = pd.DataFrame()
    for url in urls_to_scrape:
        league_table = scrape_league_table(url)
        league_table = clean_league_table(league_table)
        league_tables = pd.concat([league_tables, league_table])

    updates_df = league_tables.merge(new_matches, on = "url", how = "left")

    updates_df.columns = updates_df.columns.str.lower()
    updates_df.game_date = updates_df.game_date.dt.date
    updates_df = manually_update_manager(updates_df)
    updates_df = updates_df[["season", "competition", "league_tier", "ranking", "pld", "pts", "manager", "game_date"]].sort_values("pld", ascending = False).reset_index(drop =True)
    
    results_mini = pd.read_csv("./docs/input/results_mini.csv")
    
    updated_results_mini = pd.concat([updates_df, results_mini]).drop_duplicates(ignore_index=True)

    updated_results_mini.to_csv("./docs/input/results_mini.csv", index=False)    