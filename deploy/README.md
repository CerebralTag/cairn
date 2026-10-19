# Hosting Cairn on a Synology NAS

Cairn is static files only (the `dist/` folder). There is no server-side code and no
database: your data lives in the browser on the phone. The NAS only has to hand out
the app, once to install it and again whenever you ship an update.

**Why HTTPS matters:** Add to Home Screen can work over plain `http://`, but the offline
mode (the service worker) only runs from a secure context, which means HTTPS with a
certificate the iPhone trusts. A self-signed certificate is reported to be unreliable on
iOS. Without HTTPS you would get a home-screen icon but no offline launch.

> Things marked **(unverified)** below were written without access to a DSM machine.
> Check them against your NAS and Tailscale's own docs before relying on them.

## The address is part of your data

The browser keeps Cairn's data per web address. **Pick the final address before you
start logging for real.** If the address changes later you start with an empty app on
the new one: export a backup (Manage > Backup) from the old address and import it on
the new one. With Tailscale, that address is the NAS's `*.ts.net` name: don't rename
the machine or the tailnet afterwards.

## Route A: Tailscale (recommended; nothing is exposed to the internet)

1. **Tailscale on the NAS and on the iPhone**, both signed in to the same tailnet.
   (unverified: DSM 7 package availability and whether it needs the "run as root" /
   TUN setup. See Tailscale's Synology guide.)
2. **Turn on HTTPS certificates** in the Tailscale admin console: DNS page, enable
   MagicDNS, then under HTTPS Certificates choose Enable HTTPS. Guide:
   <https://tailscale.com/kb/1153/enabling-https>. Note from that guide: enabling it
   publishes your machine names and tailnet DNS name on a public ledger (certificate
   transparency logs), so don't put anything private in those names. Certificates made
   with `tailscale cert` expire after 90 days and you renew them yourself. Whether
   `tailscale serve` renews them for you is **(unverified)**: check the Tailscale docs.
3. **Run the app on the NAS.** Container Manager > Project > point it at a folder
   containing `deploy/docker-compose.yml` and `deploy/nginx.conf`. It serves the
   `site/` folder on port 8080.
4. **Put HTTPS in front of it.** The simplest way is Tailscale itself:
   `tailscale serve --bg 8080` (the exact flags differ between Tailscale versions:
   run `tailscale serve --help`). It publishes `https://<machine>.<tailnet>.ts.net`
   with a real certificate, reachable only from devices on your tailnet.
   (unverified on DSM: whether port 443 is free, since DSM's own web server may use it.
   If not, serve on another port, and the address will include it.)
5. **On the iPhone**, open that address in Safari, then Share > Add to Home Screen.
   Install first, then log your data in the installed app: the Home Screen app and
   Safari keep separate storage.

## Route B: public address (works without Tailscale on the phone)

DSM's reverse proxy plus a DDNS name and a Let's Encrypt certificate, with port 443
forwarded to the NAS. It works, but it puts the NAS on the internet. Not recommended
for a personal app that only you use.

## Shipping an update

```sh
# first time, into a NEW folder used only for Cairn:
CAIRN_INIT=1 NAS_TARGET=youruser@nas-hostname:/volume1/docker/cairn/site npm run deploy
# every time after that:
NAS_TARGET=youruser@nas-hostname:/volume1/docker/cairn/site npm run deploy
```

That builds the app and copies `dist/` to the NAS (it needs SSH and rsync enabled on
the NAS). Because the copy deletes anything in the destination that isn't in the build,
the script protects you: it refuses a root, home or shallow folder, refuses a folder
that isn't marked as a Cairn site (the marker is created by the first `CAIRN_INIT=1`
deploy), shows what it would change and asks before doing it, and stops if it would
delete more than 200 files. Installed phones fetch the new version the next time they
open the app online. Your data is untouched by updates.

## Checking it works

Open the address on the phone, wait a few seconds, switch to aeroplane mode and
reopen the app from the Home Screen icon: it should load with your data.
