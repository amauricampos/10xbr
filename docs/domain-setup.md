# Moving 10xbr.com to Cloudflare

There are two separate steps. Only the first is needed to put the platform on the domain.

## Current state

- The `10xbr.com` zone exists in the Cloudflare account and is **pending**: Cloudflare is waiting for the nameservers to change.
- The Worker `tenxbr` is deployed and already attached to `10xbr.com` and `www.10xbr.com` as custom domains. Both start serving, with certificates, once the zone is active.
- Until then the platform is live at `https://tenxbr.amauri.workers.dev`.
- The domain's current nameservers (`ns1.capahosting.com`, `ns2.capahosting.com`) do not answer queries, so there are no existing website or email records to carry over.

## Step 1: point the nameservers at Cloudflare

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

The domain has no mail records today. To use addresses such as `hello@10xbr.com`, add the mail provider's MX, SPF and DKIM records in Cloudflare DNS after activation. Cloudflare Email Routing is enough for forwarding to an existing inbox.
