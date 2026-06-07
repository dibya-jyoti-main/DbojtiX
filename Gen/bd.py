import os
import re
import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import pytz

# ==========================
# Branding & Configuration
# ==========================
BRAND_NAME = "IPTV PLAYLIST"
BRAND_OWNER = "Dibya Jyoti Mahanta"
VERSION = "2.0.0"

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PLAYLIST_DIR = os.path.join(ROOT_DIR, "playlists")
JSON_DIR = os.path.join(ROOT_DIR, "json")

SOURCE_URLS = [
    "https://raw.githubusercontent.com/sm-monirulislam/AynaOTT-auto-update-playlist/main/AynaOTT.m3u",
    "https://raw.githubusercontent.com/sydul104/main04/refs/heads/main/my",
    "https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/playlist.m3u",
    "https://raw.githubusercontent.com/sm-monirulislam/SM-Live-TV/refs/heads/main/Combined_Live_TV.m3u",
    "https://raw.githubusercontent.com/imShakil/tvlink/refs/heads/main/all.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/Mrgify-Tv/refs/heads/main/playlist.m3u",
    "https://raw.githubusercontent.com/time2shine/IPTV/refs/heads/master/combined.m3u",
    "https://raw.githubusercontent.com/mhmimxl/filoox-bdix-selected/main/playlist.m3u",
    "https://raw.githubusercontent.com/sm-monirulislam/RoarZone-Auto-Update-playlist/main/RoarZone.m3u",
    "https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update-Playlist/main/toffee_all_player.m3u",
    "https://raw.githubusercontent.com/Yeadee/Toffee/refs/heads/main/toffee_ns_player.m3u",
    "https://raw.githubusercontent.com/MohammadJoyChy/BDIXTV/refs/heads/main/Aynaott",
    "https://raw.githubusercontent.com/Arunjunan20/My-IPTV/refs/heads/main/index.html",
    "https://raw.githubusercontent.com/AHIL44444/GAZI-LIVE-TV-M3U8/refs/heads/main/index.html",
    "https://raw.githubusercontent.com/tanvir907/bdix/refs/heads/main/bdix.m3u",
    "https://raw.githubusercontent.com/Shaharum1010/SmartFlix_Tv_Web/refs/heads/main/SmartFlixtv",
    "https://raw.githubusercontent.com/mr-masudrana/LiveTV/refs/heads/main/Bangla_Playlist.m3u",
    "https://raw.githubusercontent.com/mr-masudrana/Web_Player-IPTV/refs/heads/main/channels.json",
    "https://iptv-org.github.io/iptv/countries/bd.m3u"
]

# ==========================
# Helper Functions
# ==========================
def clean_title(title):
    """Removes Telegram handles, GitHub owner info, and cleans up formatting."""
    title = re.sub(r'@\w+', '', title)
    title = re.sub(r'\(.*?github\.com.*?\)', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\[.*?github\.com.*?\]', '', title, flags=re.IGNORECASE)
    title = re.sub(r'github\.com/\S+', '', title, flags=re.IGNORECASE)
    
    title = re.sub(r'\s+', ' ', title).strip()
    title = title.strip('-|/\\:,')
    return title.strip()

def fetch_content(url):
    """Fetches raw content from a URL."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"❌ Failed to fetch {url}: {e}")
        return ""

def parse_content(content, url):
    """Parses M3U, HTML, or JSON content into a standardized channel list."""
    channels = []
    
    # Extract text if it's an HTML file
    if url.endswith('.html') or '<html' in content.lower()[:200]:
        soup = BeautifulSoup(content, 'html.parser')
        content = soup.get_text()
        
    lines = content.splitlines()
    extinf = None
    extgrp = None
    
    # Parse M3U format
    for line in lines:
        line = line.strip()
        if line.startswith('#EXTINF:'):
            extinf = line
            extgrp = None
        elif line.startswith('#EXTGRP:'):
            extgrp = line.split(':', 1)[1].strip()
        elif extinf and re.match(r'^(http|https|rtmp|rtsp|mms|udp|rtp)://', line):
            # Extract original title
            match = re.search(r',(.*)$', extinf)
            title = match.group(1).strip() if match else "Unknown"
            
            # Extract group from EXTINF or EXTGRP
            group_match = re.search(r'group-title="([^"]*)"', extinf)
            group = group_match.group(1).strip() if group_match else ""
            if not group and extgrp:
                group = extgrp
            if not group:
                group = "Uncategorized"
                
            # Clean title and reconstruct EXTINF to preserve attributes (like tvg-logo)
            title = clean_title(title)
            if not title:
                title = "Unknown"
                
            attrs_match = re.match(r'#EXTINF:(.*?),', extinf)
            attrs = attrs_match.group(1) if attrs_match else "-1"
            
            if 'group-title=' not in attrs and group != "Uncategorized":
                attrs += f' group-title="{group}"'
                
            new_extinf = f"#EXTINF:{attrs},{title}"
                
            channels.append({
                'title': title,
                'group': group,
                'url': line,
                'extinf': new_extinf
            })
            extinf = None
            extgrp = None
            
    # Fallback to JSON parsing if no M3U channels were found
    if not channels:
        try:
            data = json.loads(content)
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and 'url' in item:
                        title = item.get('name', item.get('title', 'Unknown'))
                        group = item.get('group', item.get('category', 'Uncategorized'))
                        if not group:
                            group = "Uncategorized"
                        url_stream = item['url']
                        
                        title = clean_title(str(title))
                        if not title:
                            title = "Unknown"
                            
                        extinf_str = f'#EXTINF:-1 group-title="{group}",{title}'
                        channels.append({
                            'title': title,
                            'group': group,
                            'url': url_stream,
                            'extinf': extinf_str
                        })
        except json.JSONDecodeError:
            pass
            
    return channels

# ==========================
# Main Execution
# ==========================
def main():
    print(f"🚀 Starting {BRAND_NAME} Collector v{VERSION}...")
    all_channels = []
    
    for url in SOURCE_URLS:
        print(f"🔗 Fetching: {url}")
        content = fetch_content(url)
        if content:
            channels = parse_content(content, url)
            print(f"   ✅ Found {len(channels)} channels.")
            all_channels.extend(channels)
            
    # Remove duplicate URLs
    seen_urls = set()
    unique_channels = []
    for ch in all_channels:
        if ch['url'] not in seen_urls:
            seen_urls.add(ch['url'])
            unique_channels.append(ch)
            
    print(f"\n📊 Total unique channels: {len(unique_channels)}")
    
    categories = set(ch['group'] for ch in unique_channels)
    print(f"📂 Total categories: {len(categories)}")
    
    # Ensure output directory exists
    os.makedirs(PLAYLIST_DIR, exist_ok=True)
    os.makedirs(JSON_DIR, exist_ok=True)
    
    # Generate timestamp
    timestamp = datetime.now(pytz.timezone('Asia/Dhaka')).strftime('%Y-%m-%d %H:%M:%S')
    
    
        
    # 1. Export M3U
    m3u_content = f"""#EXTM3U
# {BRAND_NAME}
# Powered By {BRAND_OWNER}
# Version {VERSION}
"""
    for ch in unique_channels:
        m3u_content += f"{ch['extinf']}\n{ch['url']}\n"
        
    with open(os.path.join(PLAYLIST_DIR, "playlist.m3u"), "w", encoding="utf-8") as f:
        f.write(m3u_content)
        
    # 2. Export JSON
    json_data = {
        "branding": {
            "title": BRAND_NAME,
            "owner": BRAND_OWNER,
            "version": VERSION,
            "generated": timestamp
        },
        "channels": [
            {
                "title": ch['title'],
                "group": ch['group'],
                "url": ch['url']
            } for ch in unique_channels
        ]
    }
    
    with open(os.path.join(JSON_DIR, "playlist.json"), "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)
        
    print(f"\n✨ Export completed successfully in {ROOT_DIR}")
    print(f"📺 Playlist: {os.path.join(PLAYLIST_DIR, 'playlist.m3u')}")
    print(f"📄 JSON: {os.path.join(JSON_DIR, 'playlist.json')}")

if __name__ == "__main__":
    main()
