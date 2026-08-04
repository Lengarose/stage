# President Profile Plan

## Goal
Add a public club president profile stored directly on the `clubs` row, with onboarding capture and club profile display.

## Requirements
- Add president profile fields to the `clubs` table, startup migrations, Club model, and legacy entity metadata.
- Allow existing club profile editors to update president profile fields under the existing `edit_club_profile` permission.
- Capture president profile details during club creation onboarding before the club is created.
- Display a president profile section on the public club detail page.
- Keep this as club-owned data, not a separate President entity.

## President Fields
- `president_name`
- `president_role_title`
- `president_avatar_url`
- `president_banner_url`
- `president_banner_position`
- `president_banner_zoom`
- `president_bio`
- `president_success_level`
- `president_country_code`
- `president_quote`
- `president_management_style`
- `president_started_at`
- `president_social_links`

## Tasks
1. Add tests that fail until the schema/model/controller support president fields.
2. Add tests that fail until onboarding submits president fields and Club Detail renders them.
3. Implement database schema and startup migrations.
4. Implement backend Club model/controller support.
5. Implement onboarding capture.
6. Implement public Club Detail president display.
7. Run targeted tests, lint, typecheck, backend syntax check, build, graphify update, and code review.
