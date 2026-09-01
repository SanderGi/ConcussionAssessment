# Translation sources and scope

The supported locale set is derived from the request-weighted country usage
breakdown supplied in September 2026. Countries were considered in descending
request order and their principal local language was added until 20 distinct
languages were represented. English-speaking countries were consolidated into
one locale. Danish keeps the existing `/dk/` URL for compatibility while the
generated document uses the standards-based `lang="da"` tag.

## Official SCAT6 terminology

Clinical wording in the following locales was reviewed against current SCAT6
translations published by the Concussion in Sport Group (CISG):

- Danish: <https://www.concussioninsportgroup.com/wp-content/uploads/2024/05/SCAT6-Dansk_MM.pdf>
- German: <https://www.concussioninsportgroup.com/wp-content/uploads/2025/01/SCAT6_deutsch_BrainCare_webpdf_final.pdf>
- French: <https://www.concussioninsportgroup.com/wp-content/uploads/2024/06/SCAT6-23JUIN.pdf>
- Italian: <https://www.concussioninsportgroup.com/wp-content/uploads/2025/04/SCAT6-v7-ITA.pdf>
- Norwegian: <https://www.concussioninsportgroup.com/wp-content/uploads/2026/04/Nor_SCAT6.pdf>
- Spanish: <https://www.concussioninsportgroup.com/wp-content/uploads/2024/10/SCAT6-v7-EspanTHol-Final.pdf>
- Turkish: <https://www.concussioninsportgroup.com/wp-content/uploads/2026/04/SCAT6_Turkish-final.pdf>

The canonical list of CISG-approved translated tools is
<https://www.concussioninsportgroup.com/scat-tools/>.

The fixed Immediate Memory word lists and Digits Backwards sequences in the app
remain the validated source stimuli. CISG's translation procedure explicitly
states that cognitive stimuli require cultural adaptation, back-translation,
expert review, athlete pretesting, and reliability testing; literal translation
is not clinically equivalent. They must not be replaced with ad-hoc localized
lists for languages without an approved adaptation.

## Quality checks

`node scripts/validate-i18n.mjs` verifies locale/catalog parity, non-empty
values, placeholder and markup preservation, runtime key coverage, selector
labels, BCP 47 language metadata, text direction, and generated localized
pages. It also rejects unchanged English values unless they are explicitly
allowlisted technical terms or proper names.
