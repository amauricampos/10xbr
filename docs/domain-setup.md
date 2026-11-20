# Moving 10xbr.com to Cloudflare

There are two separate steps. Only the first is needed to put the platform on the domain.

## Current state

- Step 1 is done. The `10xbr.com` zone is active on Cloudflare and the platform is served at `https://10xbr.com` and `https://www.10xbr.com` (checked 13 November 2026).
- The Worker `tenxbr` is attached to both names as custom domains. `https://tenxbr.amauri.workers.dev` still serves the same Worker.
- Step 2 and email below are still open.

## Step 1: point the nameservers at Cloudflare (done)

This has to be done in the Squarespace account, which owns the registration.

1. Sign in to Squarespace and open **Domains**, then `10xbr.com`.
2. Open **DNS**, then **Domain Nameservers**, and choose **Use custom nameservers**.
3. Enter these two and remove any others:
   - `anita.ns.cloudflare.com`
   - `phil.ns.cloudflare.com`
4. If **DNSSEC** is on in Squarespace, turn it off first. It can be turned back on in Cloudflare afterwards.
5. Save. Cloudflare usually activates the zone within an hour, and sends an email when it does.

After activation, check `https://10xbr.com` and `https://www.10xbr.com`.

## Step 2 (optional): move the registration itself

This moves billing and renewal from Squarespace to Cloudflare Registrar. It does not change how the site works.

1. Wait until the zone is active on Cloudflare.
2. In Squarespace, turn off the **domain lock** and request the **transfer authorization code**.
3. In Cloudflare, open **Domain Registration**, then **Transfer Domains**, select `10xbr.com`, and paste the code.
4. Approve the transfer email from Squarespace to speed it up. Otherwise it completes in about five days.

A domain cannot be transferred within 60 days of registration or of a previous transfer. The transfer adds one year to the registration at Cloudflare's cost price.

## Email

Outgoing mail is set up (20 November 2026). `10xbr.com` is a sending domain in Resend, and the site sends as `10x BR <hello@10xbr.com>`.

- DNS in Cloudflare, all DNS-only: TXT `resend._domainkey` (DKIM), CNAME `send` and CNAME `rsend` (SPF and bounces), with the values Resend shows for the domain.
- Worker secrets: `RESEND_API_KEY` (a key limited to sending from this domain, named "10xbr.com Worker (send only)" in Resend) and `MAIL_FROM`.

Incoming mail is not set up: the domain has no MX record, so a reply to `hello@10xbr.com` bounces. To receive replies, either set the `MAIL_REPLY_TO` secret to an inbox that is read, or turn on Cloudflare Email Routing to forward `hello@10xbr.com` to one.
