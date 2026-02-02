#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TRADIFY CONNECTOR v3.0 - MT5 Bridge
Double-click this file to run, or use: python tradify_connector.py
"""

import subprocess
import sys
import time

def install_packages():
    """Auto-install required packages if missing"""
    packages = ['MetaTrader5', 'requests']
    for pkg in packages:
        try:
            __import__(pkg.replace('-', '_').lower() if pkg != 'MetaTrader5' else 'MetaTrader5')
        except ImportError:
            print(f"[*] Installing {pkg}...")
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', pkg, '--quiet'])
            print(f"[+] {pkg} installed successfully")

def main():
    print("=" * 55)
    print("       TRADIFY TERMINAL CONNECTOR v3.0")
    print("=" * 55)
    print()
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("[!] ERROR: Python 3.8 or higher is required")
        print(f"[!] Your version: Python {sys.version}")
        input("\nPress Enter to exit...")
        return
    
    print("[*] Checking dependencies...")
    try:
        install_packages()
    except Exception as e:
        print(f"[!] Failed to install packages: {e}")
        print("[!] Please run: pip install MetaTrader5 requests")
        input("\nPress Enter to exit...")
        return
    
    # Now import after installation
    try:
        import MetaTrader5 as mt5
        import requests
    except ImportError as e:
        print(f"[!] Import error: {e}")
        print("[!] Please install packages manually:")
        print("    pip install MetaTrader5 requests")
        input("\nPress Enter to exit...")
        return
    
    # Configuration
    USER_ID = "scarymohd2@gmail.com"
    SYNC_TOKEN = "2s0krch66bwm0141lwtjv"
    API_URL = "https://tradifyapp.com/api/mt5/sync"
    
    if not USER_ID or not SYNC_TOKEN:
        print("[!] ERROR: Missing credentials!")
        print("[!] Please download a fresh connector from the Tradify MT5 Bridge page")
        print("[!] Make sure you have generated a Sync Token first")
        input("\nPress Enter to exit...")
        return
    
    print(f"[+] User ID: {USER_ID}")
    print(f"[+] Sync Token: {SYNC_TOKEN[:8]}...")
    print(f"[+] API: {API_URL}")
    print()
    
    # Initialize MT5
    print("[*] Connecting to MetaTrader 5...")
    if not mt5.initialize():
        error = mt5.last_error()
        print(f"[!] MT5 connection failed: {error}")
        print()
        print("[!] TROUBLESHOOTING:")
        print("    1. Make sure MetaTrader 5 is installed")
        print("    2. Open MetaTrader 5 and log into your account")
        print("    3. Keep MT5 running in the background")
        print("    4. Try running this script again")
        input("\nPress Enter to exit...")
        return
    
    account = mt5.account_info()
    if account is None:
        print("[!] Failed to get account info. Is MT5 logged in?")
        mt5.shutdown()
        input("\nPress Enter to exit...")
        return
    
    print(f"[+] Connected to MT5 Account: {account.login}")
    print(f"[+] Broker: {account.company}")
    print(f"[+] Balance: {account.balance} {account.currency}")
    print()
    print("[*] Starting sync loop... (Press Ctrl+C to stop)")
    print("-" * 55)
    
    from datetime import datetime
    
    while True:
        try:
            # Get account data
            account_info = mt5.account_info()
            if account_info is None:
                print(f"[!] Lost connection to MT5, retrying...")
                time.sleep(10)
                continue
            
            # Get positions
            positions = mt5.positions_get()
            pos_list = []
            if positions:
                for p in positions:
                    pos_list.append({
                        "ticket": p.ticket,
                        "symbol": p.symbol,
                        "type": "Buy" if p.type == 0 else "Sell",
                        "volume": p.volume,
                        "price": p.price_open,
                        "profit": p.profit,
                        "sl": p.sl,
                        "tp": p.tp
                    })
            
            # Get history
            start_time = datetime(2020, 1, 1).timestamp()
            history = mt5.history_deals_get(start_time, time.time())
            hist_list = []
            if history:
                for d in history:
                    if d.entry == 1:
                        hist_list.append({
                            "ticket": d.ticket,
                            "symbol": d.symbol,
                            "type": d.type,
                            "volume": d.volume,
                            "price": d.price,
                            "profit": d.profit,
                            "commission": d.commission,
                            "swap": d.swap,
                            "open_time": d.time_msc // 1000,
                            "close_time": d.time
                        })
            
            # Build payload
            payload = {
                "userId": USER_ID,
                "token": SYNC_TOKEN,
                "accountNumber": str(account_info.login),
                "balance": float(account_info.balance),
                "equity": float(account_info.equity),
                "margin": float(account_info.margin),
                "freeMargin": float(account_info.margin_free),
                "marginLevel": float(account_info.margin_level),
                "floatingPl": float(account_info.profit),
                "leverage": int(account_info.leverage),
                "currency": account_info.currency,
                "positions": pos_list,
                "history": hist_list
            }
            
            # Send to API - increased timeout from 15 to 60 seconds for cold starts
            resp = requests.post(API_URL, json=payload, timeout=60)
            timestamp = time.strftime('%H:%M:%S')
            
            if resp.status_code == 200:
                print(f"[+] {timestamp} | Synced | Equity: {account_info.equity:.2f} | Positions: {len(pos_list)}")
            elif resp.status_code == 403:
                print(f"[!] {timestamp} | Auth Error: Invalid or expired token")
                print("[!] Please generate a new token from the MT5 Bridge page")
                break
            else:
                print(f"[!] {timestamp} | Sync failed ({resp.status_code})")
            
        except requests.exceptions.RequestException as e:
            print(f"[!] Network error: {e}")
        except Exception as e:
            print(f"[!] Error: {e}")
        
        time.sleep(10)
    
    mt5.shutdown()
    input("\nPress Enter to exit...")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[*] Stopped by user")
    except Exception as e:
        print(f"\n[!] Unexpected error: {e}")
        input("\nPress Enter to exit...")
