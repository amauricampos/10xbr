# L-1A requirements and how 10x BR screens them

The screen follows the L-1A intracompany transferee rules: INA § 101(a)(15)(L), INA § 101(a)(44) for the definitions of manager and executive, 8 CFR § 214.2(l) and the USCIS Policy Manual, Volume 2, Part L. The document checklists follow the attorney's L-1A petition list.

10x BR screens. It does not give legal advice, and the immigration attorney confirms every result.

## Stage 1: one question per requirement

Each answer is Met, Needs attention or Not met. One Not met stops the record. Any Needs attention gives "Gaps to fix". The scorecard reports the count, for example "7 of 9 requirements met".

### U.S. business

| Requirement | Rule | Not met | Needs attention |
| --- | --- | --- | --- |
| Doing business | Regular, systematic and continuous provision of goods or services. 8 CFR 214.2(l)(1)(ii)(H) | Passive holding of property or investments | Seasonal or part-time |
| Operating history | A U.S. entity doing business under one year is a "new office": one-year approval, extra evidence. (l)(1)(ii)(F), (l)(3)(v) | | Under one year |
| Staff to manage | A manager works through other employees; staffing is judged against the reasonable needs of the business. INA 101(a)(44)(C) | No W-2 employees | One or two |
| Managerial structure | A first-line supervisor is not a manager unless the people supervised are professionals. INA 101(a)(44)(A)(iv) | Owner does most of the work with one or two employees | Owner supervises frontline staff directly, or does most of the work |
| Physical premises | Lease or deed and photos are petition evidence; required outright for a new office. (l)(3)(v)(A) | | Home-based or virtual |
| Ownership and control | The foreign company must own more than half and control, or own half of a 50/50 joint venture with equal control and veto. (l)(1)(ii)(K) | Less than half for sale | Exactly half |
| Company can be acquired | Buying the stock or membership interests keeps the operating history. An asset purchase into a new company makes it a new office | | Assets only |
| Transferable to a foreign owner | The acquired company must be able to keep doing business under foreign ownership | A license or contract requires a U.S. owner | Third-party approval needed, or a license only the seller holds |
| Documented operations | The petition is proven with tax returns, Form 941 and bank statements | Returns missing, mostly cash | Some pay or sales off the books |

### Brazilian candidate

| Requirement | Rule | Not met | Needs attention |
| --- | --- | --- | --- |
| Managerial or executive role | L-1A covers managers and executives only. (l)(1)(ii)(B), (C) | Any other role | |
| One continuous year abroad | One continuous year of full-time work for the foreign company within the three years before filing. Time in the U.S. does not count. (l)(3)(iii) | No | Complete within six months |
| Documented employment | Pay records are the evidence of that year | None | Gaps |
| Managerial capacity abroad | Primarily manages supervisors or professionals, or an essential function. INA 101(a)(44)(A) | Hands-on with one or two employees | Mostly hands-on |
| Active company abroad | The foreign company must be doing business | Inactive, MEI, or under one year | |
| Staff abroad | Needed to show a managerial role and to keep the company running | None | One or two |
| Company keeps operating | The foreign company must do business for the whole L-1 stay. (l)(1)(ii)(G)(2) | Would close or pause | No successor named |
| Qualifying relationship | Parent and subsidiary, or affiliates owned by the same people in about the same proportions. (l)(1)(ii)(I)-(L) | Under 50% without control | 50/50, or undecided |
| Managerial role in the U.S. | The U.S. job must itself be managerial or executive. (l)(3)(ii) | Mainly operational | Hands-on at first |

Not screened in stage 1 because no simple question settles them: the candidate's own immigration history and admissibility, and L-1A time limits (seven years in total). The attorney covers these.

## Stage 2: health and feasibility

Each number is Good, Fair or Weak. Three or more Weak, or a score under half, stops the record. Thresholds are in `PARAMS` in `shared/process.ts` and are starting points to calibrate with the broker.

### U.S. business: is it a sound purchase?

| Number | How | Good | Weak |
| --- | --- | --- | --- |
| Revenue trend | Yearly growth over three years | +5% a year or more | Shrinking over 5% a year, or two declines in a row |
| Earnings margin | Owner's earnings ÷ revenue | | |
| Price multiple | Price ÷ owner's earnings | 3.5× or less | Over 5× |
| After a manager's salary | Earnings − $75,000 | Covers it with room | Does not cover it |
| Return on price | (Earnings − $75,000) ÷ price | 20% a year or more | Under 10% |
| Debt load | Debt ÷ earnings | 1× or less | Over 2.5× |
| Team, lease, owner hours | Can it run without the seller, and for how long? | | |
| Largest customer | Share of revenue | 20% or less | Over 30% |
| Reason for sale | | | Declining business |
| Seller financing | Buyers on L-1 cannot use SBA loans | 20% or more | Never weak; cash-only is Fair |

The $75,000 matters twice: it is the investment case, and it is the L-1A case. A business that cannot pay a manager cannot support a managerial role.

### Brazilian company: can it support the transfer?

Revenue trend, profit margin, cash runway, debt against profit, tax standing, plus:

- **Company can fund**: (cash − three months of costs − debt) converted at R$5.50 per dollar with a 15% cushion for a weaker real. Good when it covers the planned investment. Company funds are the cleanest source for the petition.
- **Funds to invest**: the planned total, $300,000 or more is Good, under $150,000 is Weak.

## Stages 3 and 4: documents

The core five per track prove the stage 1 and 2 answers. Stage 4 adds the rest of the attorney's list. The AI compares each document with what the owner entered and flags differences over 10%.
