-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost
-- Généré le : ven. 15 mai 2026 à 22:50
-- Version du serveur : 8.4.3-3
-- Version de PHP : 8.3.29

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `stage_league`
--

-- --------------------------------------------------------

--
-- Structure de la table `admin_audit_log`
--

CREATE TABLE `admin_audit_log` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `old_value` text COLLATE utf8mb4_unicode_ci,
  `new_value` text COLLATE utf8mb4_unicode_ci,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `admin_audit_log`
--

INSERT INTO `admin_audit_log` (`id`, `admin_user_id`, `admin_email`, `action`, `entity_type`, `entity_id`, `entity_name`, `old_value`, `new_value`, `reason`, `created_date`) VALUES
('18f4fca6-ab49-49e5-ac90-bd892be7a374', '9d8ebd1a-3575-4305-b1e4-a91f2ba94c79', 'creaafde@hotmail.com', 'approve_player_identity_claim', 'player_identity_claim', 'd759e668-82a0-4ba8-bb55-25decc217e97', 'Lutina_17', '{\"is_verified\":false,\"claim\":{\"id\":\"564f213d-d741-4a33-ad81-f373141ca651\",\"player_id\":\"d759e668-82a0-4ba8-bb55-25decc217e97\",\"user_id\":\"2138f545-75e8-43e4-ad0a-8a1593767c1d\",\"email\":\"berton.lutina@hotmail.com\",\"gamertag\":\"Lutina_17\",\"platform\":\"PlayStation\",\"platform_handle\":\"Lutina_17\",\"ea_id\":\"Lutina_17\",\"discord_handle\":\"Lutina_17\",\"proof_url\":\"https://stageleagues.com/uploads/0356c83b-2819-4b2f-badf-65246a7966a8.jpeg\",\"notes\":\"I m new here\",\"status\":\"pending\",\"review_notes\":null,\"rejection_reason\":null,\"reviewed_by\":null,\"reviewed_by_email\":null,\"reviewed_at\":null,\"created_date\":\"2026-05-15T19:14:18.000Z\",\"updated_date\":\"2026-05-15T19:14:18.000Z\"}}', '{\"is_verified\":true,\"claim\":{\"id\":\"564f213d-d741-4a33-ad81-f373141ca651\",\"player_id\":\"d759e668-82a0-4ba8-bb55-25decc217e97\",\"user_id\":\"2138f545-75e8-43e4-ad0a-8a1593767c1d\",\"email\":\"berton.lutina@hotmail.com\",\"gamertag\":\"Lutina_17\",\"platform\":\"PlayStation\",\"platform_handle\":\"Lutina_17\",\"ea_id\":\"Lutina_17\",\"discord_handle\":\"Lutina_17\",\"proof_url\":\"https://stageleagues.com/uploads/0356c83b-2819-4b2f-badf-65246a7966a8.jpeg\",\"notes\":\"I m new here\",\"status\":\"approved\",\"review_notes\":null,\"rejection_reason\":null,\"reviewed_by\":null,\"reviewed_by_email\":null,\"reviewed_at\":null,\"created_date\":\"2026-05-15T19:14:18.000Z\",\"updated_date\":\"2026-05-15T19:14:18.000Z\"}}', 'Verified by admin review', '2026-05-15 20:28:18'),
('992c1182-9420-42ab-b20a-b638efae1342', '2c799afb-4a0c-11f1-8e8d-00163e198961', 'krikke', 'approve_player_identity_claim', 'player_identity_claim', '645b11a4-8df8-4799-bf58-9dcd8ef302cb', 'Lengarose', '{\"is_verified\":false,\"claim\":{\"id\":\"951c5681-e483-478a-a1e4-795e0073c660\",\"player_id\":\"645b11a4-8df8-4799-bf58-9dcd8ef302cb\",\"user_id\":\"8eb399a1-b998-4ffb-8605-10a07db3e08f\",\"email\":\"emmanuel.kalonji@hotmail.com\",\"gamertag\":\"Lengarose\",\"platform\":\"PlayStation\",\"platform_handle\":\"KaioTheKid6\",\"ea_id\":\"Lengarose\",\"discord_handle\":null,\"proof_url\":null,\"notes\":null,\"status\":\"pending\",\"review_notes\":null,\"rejection_reason\":null,\"reviewed_by\":null,\"reviewed_by_email\":null,\"reviewed_at\":null,\"created_date\":\"2026-05-15T14:30:20.000Z\",\"updated_date\":\"2026-05-15T14:30:20.000Z\"}}', '{\"is_verified\":true,\"claim\":{\"id\":\"951c5681-e483-478a-a1e4-795e0073c660\",\"player_id\":\"645b11a4-8df8-4799-bf58-9dcd8ef302cb\",\"user_id\":\"8eb399a1-b998-4ffb-8605-10a07db3e08f\",\"email\":\"emmanuel.kalonji@hotmail.com\",\"gamertag\":\"Lengarose\",\"platform\":\"PlayStation\",\"platform_handle\":\"KaioTheKid6\",\"ea_id\":\"Lengarose\",\"discord_handle\":null,\"proof_url\":null,\"notes\":null,\"status\":\"approved\",\"review_notes\":null,\"rejection_reason\":null,\"reviewed_by\":null,\"reviewed_by_email\":null,\"reviewed_at\":null,\"created_date\":\"2026-05-15T14:30:20.000Z\",\"updated_date\":\"2026-05-15T14:30:20.000Z\"}}', 'Verified by admin review', '2026-05-15 14:34:30');

-- --------------------------------------------------------

--
-- Structure de la table `archetypes`
--

CREATE TABLE `archetypes` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `base_modifiers` json DEFAULT NULL,
  `signature_playstyles` json DEFAULT NULL,
  `icon_inspiration` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `archetypes`
--

INSERT INTO `archetypes` (`id`, `code`, `name`, `position`, `description`, `base_modifiers`, `signature_playstyles`, `icon_inspiration`, `sort_order`, `is_active`, `created_date`, `updated_date`) VALUES
('00c20520-9392-44c3-8399-2a54a99f5d52', 'wing_wizard', 'Wing Wizard', 'RW', 'Trickster wide forward with flair.', '{\"flair\": 1.1, \"shooting\": 1.04, \"dribbling\": 1.1}', '[\"Flair\", \"Trivela\", \"Trickster\"]', 'Ronaldinho', 4, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('0a2135af-20f8-4643-80a5-c023394735ac', 'stopper', 'Stopper', 'CB', 'Old-school defender, wins his duels.', '{\"heading\": 1.1, \"physical\": 1.06, \"defending\": 1.12}', '[\"Aerial Threat\", \"Slide Tackle\", \"Bruiser\"]', 'Maldini', 10, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('11faad39-93b4-4931-9cac-7b259f9760c8', 'anchor', 'Anchor', 'CDM', 'Defensive shield in front of the back four.', '{\"physical\": 1.08, \"defending\": 1.1, \"interceptions\": 1.1}', '[\"Intercept\", \"Block\", \"Bruiser\"]', 'Makelele', 8, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('12236482-b6ec-4b65-8667-0d599d10b863', 'box_to_box', 'Box-to-Box', 'CM', 'Engine that covers both boxes.', '{\"passing\": 1.05, \"stamina\": 1.1, \"physical\": 1.07}', '[\"Press Proven\", \"Long Ball Pass\"]', 'Vieira', 6, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('1461b64f-0ece-414e-abd1-64c1312e98e8', 'ball_player_cb', 'Ball-Playing CB', 'CB', 'CB comfortable bringing it out.', '{\"passing\": 1.08, \"composure\": 1.1, \"defending\": 1.05}', '[\"Long Ball Pass\", \"Anticipate\"]', 'Beckenbauer', 9, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('37c9efa8-4367-49ef-b4f6-cb69a2ef6b7e', 'speedster', 'Speedster', 'LW', 'Pure pace and direct running.', '{\"pace\": 1.12, \"shooting\": 1.03, \"dribbling\": 1.05}', '[\"Quickstep\", \"Rapid\"]', 'Mbappé', 3, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('3e084a9c-6b4f-42e1-99f6-e4fca1731949', 'deep_lying', 'Deep-Lying Playmaker', 'CDM', 'Deep conductor, long-range distribution.', '{\"vision\": 1.1, \"passing\": 1.1, \"defending\": 1.03}', '[\"Long Ball Pass\", \"Pinged Pass\"]', 'Pirlo', 7, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('464d3afe-5664-4b32-acb5-cb403f8a08fb', 'target_man', 'Target Man', 'ST', 'Aerial pivot who holds up play for runners.', '{\"heading\": 1.12, \"physical\": 1.1, \"shooting\": 1.05}', '[\"Aerial Threat\", \"Press Proven\"]', 'Crouch', 1, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('60973b91-06b3-4098-a711-aaed9505321f', 'attacking_fb', 'Attacking Full-Back', 'LB', 'Modern overlapping full-back.', '{\"pace\": 1.08, \"crossing\": 1.08, \"dribbling\": 1.05}', '[\"Whipped Pass\", \"Quickstep\"]', 'Cafu', 11, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('acc22df8-9568-4f6d-8fd1-6950c438b352', 'false_nine', 'False Nine', 'ST', 'Drops deep to dribble and create.', '{\"agility\": 1.05, \"passing\": 1.07, \"dribbling\": 1.08}', '[\"Trickster\", \"Incisive Pass\"]', 'Messi', 2, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('ad4e6851-235a-422b-85db-54a0479a4124', 'poacher', 'Poacher', 'ST', 'Penalty-box predator, lives off through-balls.', '{\"pace\": 1.04, \"shooting\": 1.08, \"positioning\": 1.1}', '[\"Finesse Shot\", \"Power Header\"]', 'Inzaghi', 0, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('d0ffe398-a4ff-40da-b8ae-c43ef7250159', 'playmaker', 'Playmaker', 'CAM', 'Vision-led tempo controller.', '{\"vision\": 1.1, \"passing\": 1.1, \"dribbling\": 1.05}', '[\"Incisive Pass\", \"Tiki Taka\"]', 'Iniesta', 5, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17'),
('d3dc00c3-7790-43cd-bd51-b75d8b9ead2a', 'shot_stopper', 'Shot Stopper', 'GK', 'Pure goalkeeping reflexes.', '{\"diving\": 1.08, \"handling\": 1.05, \"reflexes\": 1.12}', '[\"Acrobatic\", \"Far Throw\"]', 'Buffon', 12, 1, '2026-05-13 20:43:17', '2026-05-13 20:43:17');

-- --------------------------------------------------------

--
-- Structure de la table `auth_tokens`
--

CREATE TABLE `auth_tokens` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `refresh_token` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `auth_tokens`
--

INSERT INTO `auth_tokens` (`id`, `email`, `refresh_token`, `created_date`) VALUES
('0bff0c58-e619-40d9-aa42-6dd787e14438', 'emmanuel.kalonji@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijg2MTJjYzBlLWZiNjctNDNhYy04YTliLWQ2N2E0MWRjOTE1MCIsImVtYWlsIjoiZW1tYW51ZWwua2Fsb25qaUBob3RtYWlsLmNvbSIsImlhdCI6MTc3ODg4NDg3MSwiZXhwIjoxNzc5NDg5NjcxfQ.tbG4HbZIjl2lbslJek0ipuWH8jlvEplJXu9mEBEXqFs', '2026-05-15 22:41:11'),
('0e18a469-0e95-4d14-ad20-6c0fed292cd4', 'krikke', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJjNzk5YWZiLTRhMGMtMTFmMS04ZThkLTAwMTYzZTE5ODk2MSIsImVtYWlsIjoia3Jpa2tlIiwiaWF0IjoxNzc4NTIyNTk1LCJleHAiOjE3NzkxMjczOTV9.FdzdkOhXj57j2hfUOFfrsjwTiIZcPjbjJg3mu55La24', '2026-05-11 18:03:15'),
('26b57812-1228-4b24-883e-2c86c8b603ff', 'krikke', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJjNzk5YWZiLTRhMGMtMTFmMS04ZThkLTAwMTYzZTE5ODk2MSIsImVtYWlsIjoia3Jpa2tlIiwiaWF0IjoxNzc4ODUxOTQ3LCJleHAiOjE3Nzk0NTY3NDd9.dq6GQqcNIC38UEP0zxrJp0WJTv9mL6qcVY_RxNq8cjc', '2026-05-15 13:32:27'),
('29cebb6d-f05d-4dfe-af9d-c9d233848fdc', 'krikke', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJjNzk5YWZiLTRhMGMtMTFmMS04ZThkLTAwMTYzZTE5ODk2MSIsImVtYWlsIjoia3Jpa2tlIiwiaWF0IjoxNzc4MjgzNDkwLCJleHAiOjE3Nzg4ODgyOTB9.W6haxWWp-EGBY0VnFjpY1Zps9bmAP0dxXgy8NkQUE3I', '2026-05-08 23:38:10'),
('2d6072e2-03b6-48c9-b1b3-135cf9dd4e6c', 'krikke', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJjNzk5YWZiLTRhMGMtMTFmMS04ZThkLTAwMTYzZTE5ODk2MSIsImVtYWlsIjoia3Jpa2tlIiwiaWF0IjoxNzc4MjgzNTU0LCJleHAiOjE3Nzg4ODgzNTR9.2Rr1hENcBuZTYLpbf6ZUWqahHBJs-YfoVTm8aHYKwdQ', '2026-05-08 23:39:14'),
('350064c8-ca03-4943-a4d7-9d5ac0b4a3d5', 'creaafde@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkOGViZDFhLTM1NzUtNDMwNS1iMWU0LWE5MWYyYmE5NGM3OSIsImVtYWlsIjoiY3JlYWFmZGVAaG90bWFpbC5jb20iLCJpYXQiOjE3Nzg2OTk3ODQsImV4cCI6MTc3OTMwNDU4NH0.DIwemai_t9UrA1BAFOxvZgGfhaw-fGgOBqCihrl9gRk', '2026-05-13 19:16:24'),
('36de1c28-314b-478a-b4c0-6e6218a761fd', 'krikke', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJjNzk5YWZiLTRhMGMtMTFmMS04ZThkLTAwMTYzZTE5ODk2MSIsImVtYWlsIjoia3Jpa2tlIiwiaWF0IjoxNzc4NzgwNjMwLCJleHAiOjE3NzkzODU0MzB9.XDZvupdSbVuFtiSCeBO9ANwh6ueogYOhtPbChiSuvSA', '2026-05-14 17:43:50'),
('3b536c4e-4b1d-45ab-befc-62dd5be924f5', 'creaafde@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkOGViZDFhLTM1NzUtNDMwNS1iMWU0LWE5MWYyYmE5NGM3OSIsImVtYWlsIjoiY3JlYWFmZGVAaG90bWFpbC5jb20iLCJpYXQiOjE3NzgwOTc1MzYsImV4cCI6MTc3ODcwMjMzNn0.2eKBXfNQtowEbftQlSiZwKbLZ1W3idWCh1SmWlHA74I', '2026-05-06 19:58:56'),
('58eaddea-e550-40b8-85d4-112a5fb02f0d', 'creaafde@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkOGViZDFhLTM1NzUtNDMwNS1iMWU0LWE5MWYyYmE5NGM3OSIsImVtYWlsIjoiY3JlYWFmZGVAaG90bWFpbC5jb20iLCJpYXQiOjE3NzgwOTYwNjEsImV4cCI6MTc3ODcwMDg2MX0.1ypkAQmurpAxz1yJJ4RCun9_vLYZwtVJ1ADDVJlPJLA', '2026-05-06 19:34:21'),
('668ad6a4-2b13-4ca2-bd52-d0cfe0db03b8', 'emmanuel.kalonji@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE2NGRmMzYxLTJkNzYtNDk0OS04Y2NmLWY2NTE5MzJlZjBjOSIsImVtYWlsIjoiZW1tYW51ZWwua2Fsb25qaUBob3RtYWlsLmNvbSIsImlhdCI6MTc3ODg4NTIzMSwiZXhwIjoxNzc5NDkwMDMxfQ._dYQiLPqFsLOwsCw8OQ-ITfzdj4qAR0_FUeuvLkW5vI', '2026-05-15 22:47:11'),
('6ff837e2-0726-4bd8-94df-403fa32511d4', 'creaafde@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkOGViZDFhLTM1NzUtNDMwNS1iMWU0LWE5MWYyYmE5NGM3OSIsImVtYWlsIjoiY3JlYWFmZGVAaG90bWFpbC5jb20iLCJpYXQiOjE3NzgwOTcwNDEsImV4cCI6MTc3ODcwMTg0MX0.Cgj5VByd3K1ScvBlJeonMTF0OX7VtBqdRtlevlVD2oI', '2026-05-06 19:50:41'),
('80e79903-71d7-453c-82ea-b827509d9a89', 'berton.lutina@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxMzhmNTQ1LTc1ZTgtNDNlNC1hZDBhLThhMTU5Mzc2N2MxZCIsImVtYWlsIjoiYmVydG9uLmx1dGluYUBob3RtYWlsLmNvbSIsImlhdCI6MTc3ODg3NTQyMSwiZXhwIjoxNzc5NDgwMjIxfQ.qh5wHsKghu5T2KC2o148gkM63LoDT_j420ni4ek-QF0', '2026-05-15 20:03:41'),
('8b9377ed-544f-437d-b186-62e647c10587', 'berton.lutina@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxMzhmNTQ1LTc1ZTgtNDNlNC1hZDBhLThhMTU5Mzc2N2MxZCIsImVtYWlsIjoiYmVydG9uLmx1dGluYUBob3RtYWlsLmNvbSIsImlhdCI6MTc3ODI1MjYzNSwiZXhwIjoxNzc4ODU3NDM1fQ.r1aYwwKinKyBW9XfUNqR0gT_4lUXFgzXXoqCE4TzeWI', '2026-05-08 15:03:55'),
('9b4ca9af-4502-4e22-8bd1-be410c94ccec', 'krikke', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJjNzk5YWZiLTRhMGMtMTFmMS04ZThkLTAwMTYzZTE5ODk2MSIsImVtYWlsIjoia3Jpa2tlIiwiaWF0IjoxNzc4MjMwNDQyLCJleHAiOjE3Nzg4MzUyNDJ9.t6PRSoHIeAK68K8PD2sr-Qg1bdjw6rxw09j06kLaDAI', '2026-05-08 08:54:02'),
('9b58b842-ce87-4114-a334-19ecf8bd5fa7', 'berton.lutina@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxMzhmNTQ1LTc1ZTgtNDNlNC1hZDBhLThhMTU5Mzc2N2MxZCIsImVtYWlsIjoiYmVydG9uLmx1dGluYUBob3RtYWlsLmNvbSIsImlhdCI6MTc3ODcwOTc5NywiZXhwIjoxNzc5MzE0NTk3fQ.7PU5fHKNa1cmS1M1Ex7T_PmuJ9IgXMbC31Z0YvQt1NQ', '2026-05-13 22:03:17'),
('9c09a5e2-efa0-4a75-8efa-8983e1dfd8a0', 'lutinabeats@gmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImM2MDI3MDcwLWIxMWMtNGM5Mi04ZTM0LWJlODRhODA0ZjlkOCIsImVtYWlsIjoibHV0aW5hYmVhdHNAZ21haWwuY29tIiwiaWF0IjoxNzc4MjY3NjMwLCJleHAiOjE3Nzg4NzI0MzB9.thnDwtdsuUrU9MM4IJLBfNHo0VeDEXKhQAbAD3KnDSU', '2026-05-08 19:13:50'),
('a91a7973-64cc-43bf-9a65-ea647c546a60', 'berton.lutina@gmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZjNTc0NjZiLWZiNWQtNGMzMi1iOWY0LWUzNzM5YWVkMmJlZiIsImVtYWlsIjoiYmVydG9uLmx1dGluYUBnbWFpbC5jb20iLCJpYXQiOjE3NzgxNTQxNDgsImV4cCI6MTc3ODc1ODk0OH0.iqHAQVhoX06sL2IpovnRNN9komBoeBmvjKLvJiKBVLQ', '2026-05-07 11:42:28'),
('b8c97c06-189b-4307-81da-5271564cb7bb', 'creaafde@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkOGViZDFhLTM1NzUtNDMwNS1iMWU0LWE5MWYyYmE5NGM3OSIsImVtYWlsIjoiY3JlYWFmZGVAaG90bWFpbC5jb20iLCJpYXQiOjE3Nzg1MDUyMjQsImV4cCI6MTc3OTExMDAyNH0.wMcPbmpJpY1La7Zm9oXOq6z9pmeLrHIYssBYdQScOLg', '2026-05-11 13:13:44'),
('c6743827-5928-4301-9613-55a7ef786ded', 'creaafde@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkOGViZDFhLTM1NzUtNDMwNS1iMWU0LWE5MWYyYmE5NGM3OSIsImVtYWlsIjoiY3JlYWFmZGVAaG90bWFpbC5jb20iLCJpYXQiOjE3Nzg0MjE5NzksImV4cCI6MTc3OTAyNjc3OX0.xNDW7GVYQ2nBubaCNyJOM3MSM64gwrkRSYHuBDqlxEo', '2026-05-10 14:06:19'),
('d447a795-ead1-4470-b405-044425c23591', 'krikke', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJjNzk5YWZiLTRhMGMtMTFmMS04ZThkLTAwMTYzZTE5ODk2MSIsImVtYWlsIjoia3Jpa2tlIiwiaWF0IjoxNzc4ODcyODIyLCJleHAiOjE3Nzk0Nzc2MjJ9.NxXvAVIe3T9O5iNW81mbd2GcXAiyObKSuKW8nUeXa_U', '2026-05-15 19:20:22'),
('de4fb9cd-5190-4a98-987c-cc329e2f1f73', 'krikke', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJjNzk5YWZiLTRhMGMtMTFmMS04ZThkLTAwMTYzZTE5ODk2MSIsImVtYWlsIjoia3Jpa2tlIiwiaWF0IjoxNzc4MjgzMzM3LCJleHAiOjE3Nzg4ODgxMzd9.6iv_RMGmk7LPy9On0CNjmQjMxKqZ-LzaLpu0jOOfTZ4', '2026-05-08 23:35:37'),
('e1b0f651-bfa6-47ea-b98e-3734cee1f1aa', 'creaafde@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkOGViZDFhLTM1NzUtNDMwNS1iMWU0LWE5MWYyYmE5NGM3OSIsImVtYWlsIjoiY3JlYWFmZGVAaG90bWFpbC5jb20iLCJpYXQiOjE3NzgwOTIyNTQsImV4cCI6MTc3ODY5NzA1NH0.vMsdbsvjfI22czQWUTb9V12eaTEalU8i2tc5GOmtDF0', '2026-05-06 18:30:54'),
('e68b4c88-969e-40dd-b632-63c379e47608', 'creaafde@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkOGViZDFhLTM1NzUtNDMwNS1iMWU0LWE5MWYyYmE5NGM3OSIsImVtYWlsIjoiY3JlYWFmZGVAaG90bWFpbC5jb20iLCJpYXQiOjE3Nzg4NjgyNjEsImV4cCI6MTc3OTQ3MzA2MX0.pvYEUmwhOuZLKVIKIf2-fE8NP0XOlSnHAFbW2GxpDls', '2026-05-15 18:04:21'),
('ecf55a2d-f97c-4b95-9193-036bfc9d2cfd', 'krikke', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJjNzk5YWZiLTRhMGMtMTFmMS04ZThkLTAwMTYzZTE5ODk2MSIsImVtYWlsIjoia3Jpa2tlIiwiaWF0IjoxNzc4Mzc0MTg3LCJleHAiOjE3Nzg5Nzg5ODd9.QlOzMwYXntidhvY6pY6w83gqQZA83pnAoUjPf6_GZqc', '2026-05-10 00:49:47'),
('f35e048d-14da-405a-881a-7806bdbd17e4', 'berton.lutina@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxMzhmNTQ1LTc1ZTgtNDNlNC1hZDBhLThhMTU5Mzc2N2MxZCIsImVtYWlsIjoiYmVydG9uLmx1dGluYUBob3RtYWlsLmNvbSIsImlhdCI6MTc3ODEzMDAzMywiZXhwIjoxNzc4NzM0ODMzfQ.H9PhhVx6PFH0tOMzgo8evs2d2HEyWwB8RFrL6OyImns', '2026-05-07 05:00:33'),
('fe1ee8a4-e5d6-4026-9372-aacee331b768', 'creaafde@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkOGViZDFhLTM1NzUtNDMwNS1iMWU0LWE5MWYyYmE5NGM3OSIsImVtYWlsIjoiY3JlYWFmZGVAaG90bWFpbC5jb20iLCJpYXQiOjE3Nzg4NTI5OTgsImV4cCI6MTc3OTQ1Nzc5OH0.-jfpXeTM-jyyxfnt39-ktstmrlgyOBL9aWUjFY1AzNA', '2026-05-15 13:49:58'),
('fe7e5d45-5147-43e9-bcf3-d53654a52b4e', 'berton.lutina@hotmail.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxMzhmNTQ1LTc1ZTgtNDNlNC1hZDBhLThhMTU5Mzc2N2MxZCIsImVtYWlsIjoiYmVydG9uLmx1dGluYUBob3RtYWlsLmNvbSIsImlhdCI6MTc3ODUxMjMxMSwiZXhwIjoxNzc5MTE3MTExfQ.gWaOMSpB610tpiXgWWLGnFzRAWpldLBAiwoThwZcRig', '2026-05-11 15:11:51');

-- --------------------------------------------------------

--
-- Structure de la table `challenges`
--

CREATE TABLE `challenges` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `challenger_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `challenger_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `challenger_club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opponent_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opponent_club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opponent_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opponent_player_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'friendly',
  `scheduled_date` datetime DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `home_score` int DEFAULT NULL,
  `away_score` int DEFAULT NULL,
  `winner_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wager_credits` decimal(10,2) DEFAULT '0.00',
  `challenger_wager_paid` tinyint(1) DEFAULT '0',
  `opponent_wager_paid` tinyint(1) DEFAULT '0',
  `live_match_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `chat_messages`
--

CREATE TABLE `chat_messages` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `match_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `channel` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_avatar` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `chemistry_links`
--

CREATE TABLE `chemistry_links` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_a_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_b_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `link_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bonus_factor` decimal(4,3) DEFAULT '1.000',
  `source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `clubs`
--

CREATE TABLE `clubs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo_url` text COLLATE utf8mb4_unicode_ci,
  `logo_position` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `wins` int DEFAULT '0',
  `losses` int DEFAULT '0',
  `draws` int DEFAULT '0',
  `goals_scored` int DEFAULT '0',
  `goals_conceded` int DEFAULT '0',
  `rating` decimal(5,1) DEFAULT '0.0',
  `peak_rating` decimal(5,1) DEFAULT '0.0',
  `matches_ranked` int DEFAULT '0',
  `is_provisional` tinyint(1) DEFAULT '1',
  `credits` int DEFAULT '0',
  `stc` decimal(12,2) DEFAULT '0.00',
  `wage_budget_stc` decimal(12,2) DEFAULT '0.00',
  `transfer_budget_stc` decimal(12,2) DEFAULT '0.00',
  `stadium_level` int DEFAULT '1',
  `stadium_capacity` int DEFAULT '10000',
  `tier` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'bronze',
  `form` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `win_streak` int DEFAULT '0',
  `loss_streak` int DEFAULT '0',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `formation` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lineup` json DEFAULT NULL,
  `trophies` json DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_position` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_zoom` int DEFAULT NULL,
  `logo_frame_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ranking_points` int DEFAULT '0',
  `global_rank` int DEFAULT '0',
  `regional_rank` int DEFAULT '0',
  `stadium_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `achievements` json DEFAULT NULL
) ;

--
-- Déchargement des données de la table `clubs`
--

INSERT INTO `clubs` (`id`, `owner_email`, `name`, `tag`, `platform`, `region`, `country_code`, `logo_url`, `logo_position`, `description`, `wins`, `losses`, `draws`, `goals_scored`, `goals_conceded`, `rating`, `peak_rating`, `matches_ranked`, `is_provisional`, `credits`, `stc`, `wage_budget_stc`, `transfer_budget_stc`, `stadium_level`, `stadium_capacity`, `tier`, `form`, `win_streak`, `loss_streak`, `status`, `formation`, `lineup`, `trophies`, `created_date`, `updated_date`, `user_id`, `banner_url`, `banner_position`, `banner_zoom`, `logo_frame_id`, `ranking_points`, `global_rank`, `regional_rank`, `stadium_name`, `achievements`) VALUES
('81ce69e2-5b46-4c68-ba36-af03b70b9709', 'chris.dm.kalonji@hotmail.com', 'FC Bayern Munich', 'FCB', 'PlayStation', 'Europe', 'BE', 'https://stageleagues.com/uploads/824c78e5-c998-480d-a1e5-a7ff9897dcee.webp', NULL, '', 0, 0, 0, 0, 0, 1500.0, 1500.0, 0, 1, 0, 30000000.00, 5000000.00, 10000000.00, 0, 5000, 'Silver', NULL, 0, 0, 'active', NULL, NULL, NULL, '2026-05-08 08:23:09', '2026-05-08 08:26:18', '7aca58a2-c6a8-40a3-870f-a269dff6372d', 'https://stageleagues.com/uploads/0a90f28b-c572-4d6d-a656-075d2407cf65.avif', '50% 0%', 106, NULL, 0, 0, 0, NULL, NULL),
('9ae52991-60be-4309-a28e-f7c16f23b0e5', 'berton.lutina@hotmail.com', 'Zaire', 'ZAZA', 'PlayStation', 'Europe', 'BE', NULL, NULL, 'ZAIRE ZAZA FC ⚽🔥\n\nBuilt on passion, discipline, and teamwork. Fearless on the pitch, united off it. At Zaire Zaza FC, football is more than a game — it’s family, ambition, and the drive to win together.\n\nOne Team • One Dream', 0, 0, 0, 0, 0, 1500.0, 1500.0, 0, 1, 0, 29998500.00, 5000000.00, 10000000.00, 0, 5000, 'Silver', NULL, 0, 0, 'active', NULL, NULL, NULL, '2026-05-07 05:02:29', '2026-05-11 23:16:49', '2138f545-75e8-43e4-ad0a-8a1593767c1d', NULL, NULL, NULL, NULL, 0, 0, 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `club_achievements`
--

CREATE TABLE `club_achievements` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `club_tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_number` int NOT NULL,
  `season_label` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` int DEFAULT NULL,
  `position_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `badge_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'participant',
  `stc_awarded` decimal(12,2) DEFAULT '0.00',
  `trophy_image_url` text COLLATE utf8mb4_unicode_ci,
  `awarded_at` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `club_applicants`
--

CREATE TABLE `club_applicants` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_type` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `source_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT 'new',
  `preferred_position` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `club_fixture_availability`
--

CREATE TABLE `club_fixture_availability` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fixture_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fixture_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'no_response',
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `club_fixture_lineups`
--

CREATE TABLE `club_fixture_lineups` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fixture_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fixture_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `formation` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `starting_players` json DEFAULT NULL,
  `bench_players` json DEFAULT NULL,
  `captain_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `created_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `club_operation_audit_logs`
--

CREATE TABLE `club_operation_audit_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `club_staff_roles`
--

CREATE TABLE `club_staff_roles` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permissions` json DEFAULT NULL,
  `assigned_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `comments`
--

CREATE TABLE `comments` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `post_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `author_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_avatar` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `competitions`
--

CREATE TABLE `competitions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tier` int DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `logo_url` text COLLATE utf8mb4_unicode_ci,
  `banner_url` text COLLATE utf8mb4_unicode_ci,
  `primary_color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_clubs_per_season` int DEFAULT '16',
  `promotion_spots` int DEFAULT '2',
  `relegation_spots` int DEFAULT '2',
  `playoff_spots` int DEFAULT '4',
  `qualification_spots_per_region` int DEFAULT '2',
  `current_season` int DEFAULT '1',
  `is_active` tinyint(1) DEFAULT '1',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `trophy_image_url` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `competition_fixtures`
--

CREATE TABLE `competition_fixtures` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `season_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_tier` int DEFAULT NULL,
  `competition_slug` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_number` int DEFAULT NULL,
  `match_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `home_club_tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `away_club_tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phase` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'league',
  `tie_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `leg` int DEFAULT NULL,
  `matchday` int DEFAULT NULL,
  `round` int DEFAULT NULL,
  `bracket_position` int DEFAULT NULL,
  `scheduled_date` datetime DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'scheduled',
  `home_score` int DEFAULT '0',
  `away_score` int DEFAULT '0',
  `home_submitted_score` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_submitted_score` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stats_processed` tinyint(1) DEFAULT '0',
  `window_start` datetime DEFAULT NULL,
  `window_end` datetime DEFAULT NULL,
  `window_days` int DEFAULT '5',
  `scheduling_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `home_proposed_date` datetime DEFAULT NULL,
  `away_proposed_date` datetime DEFAULT NULL,
  `confirmed_date` datetime DEFAULT NULL,
  `last_proposed_by` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proposal_count` int DEFAULT '0',
  `admin_notes` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `competition_seasons`
--

CREATE TABLE `competition_seasons` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `competition_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_tier` int DEFAULT NULL,
  `competition_slug` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_number` int DEFAULT '1',
  `season_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Cross-Platform',
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Global',
  `format` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'league_36_8md',
  `num_league_matchdays` int DEFAULT '8',
  `fixtures_generated` tinyint(1) DEFAULT '0',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `archived_at` datetime DEFAULT NULL,
  `next_season_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `playoff_format` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '9_24_bracket',
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `registration_deadline` datetime DEFAULT NULL,
  `registered_club_ids` json DEFAULT NULL,
  `num_clubs` int DEFAULT '0',
  `league_matchday_total` int DEFAULT '0',
  `current_matchday` int DEFAULT '1',
  `winner_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `runner_up_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `runner_up_club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prize_pool_stc` decimal(10,2) DEFAULT '0.00',
  `trophy_item_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_notes` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `competition_standings`
--

CREATE TABLE `competition_standings` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `season_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_tier` int DEFAULT NULL,
  `competition_slug` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_number` int DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `club_tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` int DEFAULT '0',
  `played` int DEFAULT '0',
  `wins` int DEFAULT '0',
  `draws` int DEFAULT '0',
  `losses` int DEFAULT '0',
  `goals_for` int DEFAULT '0',
  `goals_against` int DEFAULT '0',
  `goal_difference` int DEFAULT '0',
  `points` int DEFAULT '0',
  `form` json DEFAULT NULL,
  `is_promoted` tinyint(1) DEFAULT '0',
  `is_relegated` tinyint(1) DEFAULT '0',
  `is_playoff_qualified` tinyint(1) DEFAULT '0',
  `is_direct_knockout` tinyint(1) DEFAULT '0',
  `is_eliminated` tinyint(1) DEFAULT '0',
  `final_position` int DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `direct_messages`
--

CREATE TABLE `direct_messages` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `conversation_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `sender_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `read` tinyint(1) DEFAULT '0',
  `media_url` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `dressing_rooms`
--

CREATE TABLE `dressing_rooms` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `match_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `seated_players` json DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `faq_items`
--

CREATE TABLE `faq_items` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `question` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `answer` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `faq_items`
--

INSERT INTO `faq_items` (`id`, `question`, `answer`, `sort_order`, `is_active`, `created_date`, `updated_date`) VALUES
('faq-seed-free', 'Is STAGE free to use?', 'Yes — STAGE is free to join. Some premium features and store items require STC, which can be earned through gameplay.', 5, 1, '2026-05-15 20:45:47', '2026-05-15 20:45:47'),
('faq-seed-game', 'What game does STAGE support?', 'STAGE is built around EA FC (formerly FIFA). We support all major platforms including PlayStation and Xbox.', 2, 1, '2026-05-15 20:45:47', '2026-05-15 20:45:47'),
('faq-seed-join-stage', 'How do I join STAGE?', 'Create your account, complete your player profile, and either create a club or join an existing one. From there you can register for leagues and competitions.', 1, 1, '2026-05-15 20:45:47', '2026-05-15 20:45:47'),
('faq-seed-leagues', 'How do leagues and competitions work?', 'Leagues are seasonal competitions where clubs compete over multiple rounds. Competitions include knockout-style cups. Results are tracked and standings update in real time.', 3, 1, '2026-05-15 20:45:47', '2026-05-15 20:45:47'),
('faq-seed-stc', 'What are STC points?', 'STC (STAGE Coins) are the platform currency. Earn them through match rewards, seasonal prizes, and achievements. Use them in the Lifestyle store or on premium features.', 4, 1, '2026-05-15 20:45:47', '2026-05-15 20:45:47');

-- --------------------------------------------------------

--
-- Structure de la table `fixture_admin_actions`
--

CREATE TABLE `fixture_admin_actions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fixture_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fixture_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `performed_by` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performed_by_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci,
  `admin_note` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `follows`
--

CREATE TABLE `follows` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `follower_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `follower_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `follows`
--

INSERT INTO `follows` (`id`, `follower_email`, `follower_player_id`, `target_id`, `target_type`, `target_name`, `created_date`) VALUES
('2d736762-dc65-48a8-9cbe-3dba200ceec7', 'berton.lutina@hotmail.com', 'd759e668-82a0-4ba8-bb55-25decc217e97', '153014cd-f6b7-4a59-8d38-5b52c06e5863', 'player', 'Lyano24', '2026-05-07 05:47:05'),
('6474c39a-1edd-4c33-ab7b-04a2580093aa', 'lutinabeats@gmail.com', '153014cd-f6b7-4a59-8d38-5b52c06e5863', '9ae52991-60be-4309-a28e-f7c16f23b0e5', 'club', 'Zaire', '2026-05-07 05:06:40');

-- --------------------------------------------------------

--
-- Structure de la table `home_page_contents`
--

CREATE TABLE `home_page_contents` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hero_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_subtitle` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_description` text COLLATE utf8mb4_unicode_ci,
  `hero_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_1_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_1_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_2_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_2_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_3_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_3_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section1_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section1_text` text COLLATE utf8mb4_unicode_ci,
  `section1_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section2_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section2_text` text COLLATE utf8mb4_unicode_ci,
  `section2_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section3_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section3_text` text COLLATE utf8mb4_unicode_ci,
  `section3_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `faq_items` longtext COLLATE utf8mb4_unicode_ci,
  `contact_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `footer_tagline` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `home_page_contents`
--

INSERT INTO `home_page_contents` (`id`, `hero_title`, `hero_subtitle`, `hero_description`, `hero_image_url`, `hero_cta_1_label`, `hero_cta_1_url`, `hero_cta_2_label`, `hero_cta_2_url`, `hero_cta_3_label`, `hero_cta_3_url`, `section1_title`, `section1_text`, `section1_image_url`, `section2_title`, `section2_text`, `section2_image_url`, `section3_title`, `section3_text`, `section3_image_url`, `faq_items`, `contact_email`, `footer_tagline`, `created_date`, `updated_date`) VALUES
('eb403d52-3b31-4f28-9252-b04244256c87', 'Welcome To', 'STAGE', 'Create your club, compete in structured leagues and tournaments, and build your legacy in the ultimate competitive football gaming community.', '', 'Competitions', '/competitions', 'Game Day', '/game-day', 'Store', '/lifestyle', 'What is STAGE?', 'STAGE is the premier structured competitive platform for EA FC players. We provide the infrastructure for real clubs, real leagues, and real trophies — all within a professional community built around the game.', 'https://stageleagues.com/uploads/506a26bc-eeaa-4a9a-bacc-07ec0bd19a4f.PNG', 'How It Works', 'Register your club, sign players to contracts, and enter league seasons or knockout tournaments. Every match is tracked, every goal counts, and every season crowns a champion.', 'https://stageleagues.com/uploads/d1b16795-75b5-4124-8f20-14dfa8f097c0.png', 'Built for Competitors', 'From transfer markets and player contracts to STC rewards and custom trophies — STAGE gives serious players the structure and recognition their game deserves.', 'https://stageleagues.com/uploads/41b2db6d-3928-494c-8715-59b8279660f7.PNG', '[{\"question\":\"How do I join STAGE?\",\"answer\":\"Create your account, complete your player profile, and either create a club or join an existing one. From there you can register for leagues and competitions.\"},{\"question\":\"What game does STAGE support?\",\"answer\":\"STAGE is built around EA FC (formerly FIFA). We support all major platforms including PlayStation and Xbox.\"},{\"question\":\"How do leagues and competitions work?\",\"answer\":\"Leagues are seasonal competitions where clubs compete over multiple rounds. Competitions include knockout-style cups. Results are tracked and standings update in real time.\"},{\"question\":\"What are STC points?\",\"answer\":\"STC (STAGE Coins) are the platform currency. Earn them through match rewards, seasonal prizes, and achievements. Use them in the Lifestyle store or on premium features.\"},{\"question\":\"Is STAGE free to use?\",\"answer\":\"Yes — STAGE is free to join. Some premium features and store items require STC, which can be earned through gameplay.\"}]', 'support@stageleagues.com', 'The premier competitive football gaming platform.', '2026-05-15 13:44:27', '2026-05-15 13:45:12');

-- --------------------------------------------------------

--
-- Structure de la table `inbox_messages`
--

CREATE TABLE `inbox_messages` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `message_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'unread',
  `is_read` tinyint(1) DEFAULT '0',
  `related_entity_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_entity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `action_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_gamertag` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_avatar_url` text COLLATE utf8mb4_unicode_ci,
  `sender_club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `is_system` tinyint(1) DEFAULT '0'
) ;

--
-- Déchargement des données de la table `inbox_messages`
--

INSERT INTO `inbox_messages` (`id`, `recipient_email`, `sender_email`, `subject`, `body`, `message_type`, `status`, `is_read`, `related_entity_id`, `related_entity_type`, `created_date`, `action_type`, `sender_gamertag`, `sender_avatar_url`, `sender_club_name`, `metadata`, `is_system`) VALUES
('08dd9288-3086-4ecd-b134-f685713a23b1', 'lutinabeats@gmail.com', 'berton.lutina@hotmail.com', '✅ Match Accepted: Lyano24 vs Lutina_17', 'Lutina_17 has accepted your match invitation!\n\nDate: 08/05/2026 19:20:00\n\nThe match has been added to your schedule.', 'match_invite_response', 'pending', 0, NULL, NULL, '2026-05-08 19:16:27', 'none', 'Lutina_17', 'https://stageleagues.com/uploads/01fb2a18-d80d-4794-9a91-4f46730f9ec2.jpg', 'Zaire', NULL, 0),
('193c6369-b3b6-4ba9-8de2-05be6275a8ff', 'berton.lutina@hotmail.com', 'lutinabeats@gmail.com', '✅ Match Accepted: Lutina_17 vs Lyano24', 'Lyano24 has accepted your match invitation!\n\nDate: 8-5-2026, 11:20:00\n\nThe match has been added to your schedule.', 'match_invite_response', 'pending', 1, NULL, NULL, '2026-05-07 11:17:19', 'none', 'Lyano24', 'https://stageleagues.com/uploads/a590a1aa-2604-4c22-9f2c-401933d8537e.jpg', NULL, NULL, 0),
('300c475d-7db4-40a4-9da2-edca5a0ae8b7', 'lutinabeats@gmail.com', 'berton.lutina@hotmail.com', '📄 Trial Contract Offer from Zaire', 'Dear Lyano24,\n\nZaire would like to offer you a trial contract.\n\nType: Trial · 5 games or 14 days\n\nThis trial is your chance to prove yourself. Please respond using the buttons below.\n\nBest regards,\nZaire Management', 'contract_offer', 'pending', 1, 'cc548516-4cb2-4654-9bd8-e481092fd252', NULL, '2026-05-07 11:32:37', 'contract_negotiation', 'Zaire', '', 'Zaire', '{\"club_id\": \"9ae52991-60be-4309-a28e-f7c16f23b0e5\", \"club_name\": \"Zaire\", \"contract_id\": \"cc548516-4cb2-4654-9bd8-e481092fd252\", \"contract_type\": \"trial\"}', 0),
('3c3c93a5-2a9f-4317-8eae-68a7e78d4a81', 'emmanuel.kalonji@hotmail.com', 'berton.lutina@gmail.com', '⚽ Match Invitation: Andreas24 vs lengarose', 'You have received a match invitation from Andreas24.\n\nProposed date: 2026-05-07 at 14:50\n\n💰 STC Wager: 30 000 STC each side (pot: 60 000 STC). Funds will be locked from your balance on acceptance.\n\nPlease accept, decline, or request a different date.', 'match_invite', 'declined', 1, 'c93dfd34-1370-4996-92b0-514b64ab42ec', 'player', '2026-05-07 12:37:32', 'accept_decline_date', 'Andreas24', 'https://stageleagues.com/uploads/97cc4c95-136c-464b-9f49-fd6d31e13100.png', NULL, '{\"wager_stc\": 30000, \"opponent_name\": \"lengarose\", \"scheduled_date\": \"2026-05-07 12:50:00\", \"challenger_name\": \"Andreas24\", \"invitation_type\": \"player_vs_player\", \"opponent_club_id\": null, \"challenger_club_id\": null, \"opponent_player_id\": \"c93dfd34-1370-4996-92b0-514b64ab42ec\", \"challenger_player_id\": \"97d665c1-a632-4654-b8e0-2c71c75fd6a3\"}', 0),
('691cf941-ed49-400f-a0c9-754ef7886e8c', 'berton.lutina@hotmail.com', 'lutinabeats@gmail.com', '⚽ Match Invitation: Lyano24 vs Lutina_17', 'You have received a match invitation from Lyano24.\n\nProposed date: 2026-05-08 at 21:20\n\n💰 STC Wager: 30.000 STC each side (pot: 60.000 STC). Funds will be locked from your balance on acceptance.\n\nPlease accept, decline, or request a different date.', 'match_invite', 'accepted', 1, 'd759e668-82a0-4ba8-bb55-25decc217e97', 'player', '2026-05-08 19:15:42', 'accept_decline_date', 'Lyano24', 'https://stageleagues.com/uploads/a590a1aa-2604-4c22-9f2c-401933d8537e.jpg', NULL, '{\"wager_stc\": 30000, \"opponent_name\": \"Lutina_17\", \"scheduled_date\": \"2026-05-08 19:20:00\", \"challenger_name\": \"Lyano24\", \"invitation_type\": \"player_vs_player\", \"opponent_club_id\": null, \"challenger_club_id\": null, \"opponent_player_id\": \"d759e668-82a0-4ba8-bb55-25decc217e97\", \"challenger_player_id\": \"153014cd-f6b7-4a59-8d38-5b52c06e5863\"}', 0),
('69698dde-9aa5-4484-9247-e9a3ce74d3b9', 'lutinabeats@gmail.com', 'berton.lutina@hotmail.com', '⚽ Match Invitation: Lutina_17 vs Lyano24', 'You have received a match invitation from Lutina_17.\n\nProposed date: 2026-05-07 at 08:30\n\n💰 STC Wager: 30 000 STC each side (pot: 60 000 STC). Funds will be locked from your balance on acceptance.\n\nPlease accept, decline, or request a different date.', 'match_invite', 'declined', 1, '153014cd-f6b7-4a59-8d38-5b52c06e5863', 'player', '2026-05-07 06:23:58', 'accept_decline_date', 'Lutina_17', 'https://stageleagues.com/uploads/01fb2a18-d80d-4794-9a91-4f46730f9ec2.jpg', NULL, '{\"wager_stc\": 30000, \"opponent_name\": \"Lyano24\", \"scheduled_date\": \"2026-05-07 06:30:00\", \"challenger_name\": \"Lutina_17\", \"invitation_type\": \"player_vs_player\", \"opponent_club_id\": null, \"challenger_club_id\": null, \"opponent_player_id\": \"153014cd-f6b7-4a59-8d38-5b52c06e5863\", \"challenger_player_id\": \"d759e668-82a0-4ba8-bb55-25decc217e97\"}', 0),
('6b93c244-d6e1-4e4f-8f32-a45ee829a077', 'berton.lutina@gmail.com', 'emmanuel.kalonji@hotmail.com', '✅ Match Accepted: Andreas24 vs lengarose', 'lengarose has accepted your match invitation!\n\nDate: 07/05/2026, 12:50:00\n\nThe match has been added to your schedule.', 'match_invite_response', 'pending', 0, NULL, NULL, '2026-05-07 12:40:33', 'none', 'lengarose', 'https://stageleagues.com/uploads/58584e68-6304-4d03-b8a7-a6ca4b6c3ced.PNG', 'Longue Vie FC', NULL, 0),
('780c209e-f287-488f-a477-a31fae6cd307', 'emmanuel.kalonji@hotmail.com', 'emmanuel.kalonji@hotmail.com', '📄 Contract Offer from Longue Vie FC', 'Dear Lengarose,\n\nLongue Vie FC is pleased to extend an official contract offer to you. Please review the full terms below carefully before responding.\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n📋  CONTRACT DETAILS\n━━━━━━━━━━━━━━━━━━━━━━━━\nType:      Club Ownership Contract\nDuration:  999 games  or  3650 days\n           (whichever is reached first)\n\n━━━━━━━━━━━━━━━━━━━━━━━━\nPlease respond using the buttons below. You can accept the offer, send a counter-offer with your preferred terms, or decline if you wish.\n\nBest regards,\nLongue Vie FC Management', 'contract_offer', 'pending', 1, 'b0969e8c-ce9f-4c88-affa-3b45a60487ca', NULL, '2026-05-08 08:33:55', 'contract_negotiation', 'Longue Vie FC', 'https://stageleagues.com/uploads/5a123b76-ad9a-4ecc-9a42-efe969768cc8.PNG', 'Longue Vie FC', '{\"club_id\": \"2df50dab-b2b1-4106-9502-cd2437640ab6\", \"club_name\": \"Longue Vie FC\", \"contract_id\": \"b0969e8c-ce9f-4c88-affa-3b45a60487ca\", \"contract_type\": \"ownership\"}', 0),
('806a8179-b431-4429-8024-1096aa482ae3', 'lutinabeats@gmail.com', 'berton.lutina@hotmail.com', '⚽ Match Invitation: Lutina_17 vs Lyano24', 'You have received a match invitation from Lutina_17.\n\nProposed date: 2026-05-08 at 13:20\n\n💰 STC Wager: 20 000 STC each side (pot: 40 000 STC). Funds will be locked from your balance on acceptance.\n\nPlease accept, decline, or request a different date.', 'match_invite', 'accepted', 1, '153014cd-f6b7-4a59-8d38-5b52c06e5863', 'player', '2026-05-07 11:16:21', 'accept_decline_date', 'Lutina_17', 'https://stageleagues.com/uploads/01fb2a18-d80d-4794-9a91-4f46730f9ec2.jpg', NULL, '{\"wager_stc\": 20000, \"opponent_name\": \"Lyano24\", \"scheduled_date\": \"2026-05-08 11:20:00\", \"challenger_name\": \"Lutina_17\", \"invitation_type\": \"player_vs_player\", \"opponent_club_id\": null, \"challenger_club_id\": null, \"opponent_player_id\": \"153014cd-f6b7-4a59-8d38-5b52c06e5863\", \"challenger_player_id\": \"d759e668-82a0-4ba8-bb55-25decc217e97\"}', 0),
('86c65afd-2eed-41cb-af8f-93c7e87fd810', 'emmanuel.kalonji@hotmail.com', 'emmanuel.kalonji@hotmail.com', '📄 Contract Offer from Longue Vie FC', 'Dear Lengarose,\n\nLongue Vie FC is pleased to extend an official contract offer to you. Please review the full terms below carefully before responding.\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n📋  CONTRACT DETAILS\n━━━━━━━━━━━━━━━━━━━━━━━━\nType:      Star Contract\nDuration:  400 games  or  180 days\n           (whichever is reached first)\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n💰  FINANCIAL TERMS\n━━━━━━━━━━━━━━━━━━━━━━━━\nWeekly Salary:    80K STC / week\nSigning Bonus:    150K STC (paid on signing)\n\n⭐  CAPTAINCY OFFERED\nYou are being offered the captain role of Longue Vie FC.\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n🎯  PERFORMANCE TARGETS\n━━━━━━━━━━━━━━━━━━━━━━━━\n• matches played: at least 380\n• avg match rating: at least 7.5\n• pass accuracy pct: at least 90\n• clean sheets: at least 100\n\n━━━━━━━━━━━━━━━━━━━━━━━━\nPlease respond using the buttons below. You can accept the offer, send a counter-offer with your preferred terms, or decline if you wish.\n\nBest regards,\nLongue Vie FC Management', 'contract_offer', 'pending', 1, 'd29b1b11-fd7e-4f71-899f-6b7c3074100d', NULL, '2026-05-08 08:46:45', 'contract_negotiation', 'Longue Vie FC', 'https://stageleagues.com/uploads/5a123b76-ad9a-4ecc-9a42-efe969768cc8.PNG', 'Longue Vie FC', '{\"club_id\": \"2df50dab-b2b1-4106-9502-cd2437640ab6\", \"club_name\": \"Longue Vie FC\", \"contract_id\": \"d29b1b11-fd7e-4f71-899f-6b7c3074100d\", \"contract_type\": \"star\"}', 0),
('913d7e4c-b6a8-400c-bc97-9091cf10dd2e', 'lutinabeats@gmail.com', 'berton.lutina@hotmail.com', '📄 Trial Contract Offer from Zaire', 'Dear Lyano24,\n\nZaire would like to offer you a trial contract.\n\nType: Trial · 5 games or 14 days\n\nThis trial is your chance to prove yourself. Please respond using the buttons below.\n\nBest regards,\nZaire Management', 'contract_offer', 'pending', 1, 'f5397e0b-e94f-4522-a19f-9ea3be614fbf', NULL, '2026-05-07 05:31:35', 'contract_negotiation', 'Zaire', '', 'Zaire', '{\"club_id\": \"9ae52991-60be-4309-a28e-f7c16f23b0e5\", \"club_name\": \"Zaire\", \"contract_id\": \"f5397e0b-e94f-4522-a19f-9ea3be614fbf\", \"contract_type\": \"trial\"}', 0),
('9b3f6907-4285-4efb-b43c-5844ffd2e108', 'chris.dm.kalonji@hotmail.com', 'chris.dm.kalonji@hotmail.com', '📄 Contract Offer from FC Bayern Munich', 'Dear DNSTester,\n\nFC Bayern Munich is pleased to extend an official contract offer to you. Please review the full terms below carefully before responding.\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n📋  CONTRACT DETAILS\n━━━━━━━━━━━━━━━━━━━━━━━━\nType:      Club Ownership Contract\nDuration:  999 games  or  3650 days\n           (whichever is reached first)\n\n━━━━━━━━━━━━━━━━━━━━━━━━\nPlease respond using the buttons below. You can accept the offer, send a counter-offer with your preferred terms, or decline if you wish.\n\nBest regards,\nFC Bayern Munich Management', 'contract_offer', 'pending', 1, '5468a9a3-fde1-4c3f-abc7-8b8fe0c8d995', NULL, '2026-05-08 08:27:08', 'contract_negotiation', 'FC Bayern Munich', 'https://stageleagues.com/uploads/824c78e5-c998-480d-a1e5-a7ff9897dcee.webp', 'FC Bayern Munich', '{\"club_id\": \"81ce69e2-5b46-4c68-ba36-af03b70b9709\", \"club_name\": \"FC Bayern Munich\", \"contract_id\": \"5468a9a3-fde1-4c3f-abc7-8b8fe0c8d995\", \"contract_type\": \"ownership\"}', 0),
('aef76439-2f6a-4500-8a22-350409729d7c', 'lutinabeats@gmail.com', 'berton.lutina@hotmail.com', '📄 Trial Contract Offer from Zaire', 'Dear Lyano24,\n\nZaire would like to offer you a trial contract.\n\nType: Trial · 5 games or 14 days\n\nThis trial is your chance to prove yourself. Please respond using the buttons below.\n\nBest regards,\nZaire Management', 'contract_offer', 'pending', 1, '8f44cd40-5ab9-46a3-923a-8e19020ab430', NULL, '2026-05-08 15:27:52', 'contract_negotiation', 'Zaire', '', 'Zaire', '{\"club_id\": \"9ae52991-60be-4309-a28e-f7c16f23b0e5\", \"club_name\": \"Zaire\", \"contract_id\": \"8f44cd40-5ab9-46a3-923a-8e19020ab430\", \"contract_type\": \"trial\"}', 0),
('b723b66b-58b4-4314-bd22-4f513607581a', 'berton.lutina@hotmail.com', 'lutinabeats@gmail.com', '⚽ Trial Request from Lyano24', 'Hello Zaire management team,\nMy name is Lyano24, and I would like to request a trial with your club.\nPlayer Profile\n- GamerTag: Lyano24\n- Preferred Position: RB\n- Console: PlayStation\n- Overall: N/A\nExperience\nI\'am a Good left back and I always play for the team\nI am motivated, active, and ready to prove myself. Thank you for your consideration.', 'trial_request', 'accepted', 1, '9ae52991-60be-4309-a28e-f7c16f23b0e5', NULL, '2026-05-07 05:16:43', 'trial_response', 'Lyano24', 'https://stageleagues.com/uploads/a590a1aa-2604-4c22-9f2c-401933d8537e.jpg', NULL, '{\"club_id\": \"9ae52991-60be-4309-a28e-f7c16f23b0e5\", \"club_name\": \"Zaire\", \"player_id\": \"153014cd-f6b7-4a59-8d38-5b52c06e5863\", \"trial_note\": \"\", \"player_email\": \"lutinabeats@gmail.com\", \"club_logo_url\": \"\", \"player_console\": \"PlayStation\", \"player_overall\": 70, \"player_gamertag\": \"Lyano24\", \"player_position\": \"RB\", \"player_avatar_url\": \"https://stageleagues.com/uploads/a590a1aa-2604-4c22-9f2c-401933d8537e.jpg\", \"player_experience\": \"I\'am a Good left back and I always play for the team\"}', 0),
('c8460885-ea77-4610-9d4d-9011be511831', 'emmanuel.kalonji@hotmail.com', 'berton.lutina@gmail.com', '⚽ Match Invitation: Andreas24 vs lengarose', 'You have received a match invitation from Andreas24.\n\nProposed date: 2026-05-07 at 14:50\n\n💰 STC Wager: 20 000 STC each side (pot: 40 000 STC). Funds will be locked from your balance on acceptance.\n\nPlease accept, decline, or request a different date.', 'match_invite', 'accepted', 1, 'c93dfd34-1370-4996-92b0-514b64ab42ec', 'player', '2026-05-07 12:38:40', 'accept_decline_date', 'Andreas24', 'https://stageleagues.com/uploads/97cc4c95-136c-464b-9f49-fd6d31e13100.png', NULL, '{\"wager_stc\": 20000, \"opponent_name\": \"lengarose\", \"scheduled_date\": \"2026-05-07 12:50:00\", \"challenger_name\": \"Andreas24\", \"invitation_type\": \"player_vs_player\", \"opponent_club_id\": null, \"challenger_club_id\": null, \"opponent_player_id\": \"c93dfd34-1370-4996-92b0-514b64ab42ec\", \"challenger_player_id\": \"97d665c1-a632-4654-b8e0-2c71c75fd6a3\"}', 0),
('cbd3e7e3-d2b4-42ea-acbd-03dc9cb70ff2', 'berton.lutina@hotmail.com', 'lutinabeats@gmail.com', '⚽ Match Invitation: Lyano24 vs Lutina_17', 'You have received a match invitation from Lyano24.\n\nProposed date: 2026-05-07 at 15:24\n\n💰 STC Wager: 20.000 STC each side (pot: 40.000 STC). Funds will be locked from your balance on acceptance.\n\nPlease accept, decline, or request a different date.', 'match_invite', 'accepted', 1, 'd759e668-82a0-4ba8-bb55-25decc217e97', 'player', '2026-05-06 05:52:05', NULL, NULL, NULL, NULL, NULL, 0),
('ce9d2afb-8293-4708-8357-5ac38c90c15c', 'emmanuel.kalonji@hotmail.com', 'berton.lutina@hotmail.com', '⚽ Match Invitation: Lutina_17 vs Lengarose', 'You have received a match invitation from Lutina_17.\n\nProposed date: 2026-05-12 at 10:00\n\n💰 STC Wager: 50.000 STC each side (pot: 100.000 STC). Funds will be locked from your balance on acceptance.\n\nPlease accept, decline, or request a different date.', 'match_invite', 'accepted', 1, '56f54439-a875-4299-93a0-86b6a3b83dfc', 'player', '2026-05-11 23:40:11', 'accept_decline_date', 'Lutina_17', 'https://stageleagues.com/uploads/01fb2a18-d80d-4794-9a91-4f46730f9ec2.jpg', NULL, '{\"wager_stc\": 50000, \"opponent_name\": \"Lengarose\", \"scheduled_date\": \"2026-05-12 08:00:00\", \"challenger_name\": \"Lutina_17\", \"invitation_type\": \"player_vs_player\", \"opponent_club_id\": null, \"challenger_club_id\": null, \"opponent_player_id\": \"56f54439-a875-4299-93a0-86b6a3b83dfc\", \"challenger_player_id\": \"d759e668-82a0-4ba8-bb55-25decc217e97\"}', NULL),
('d63b1f5e-c484-4998-a9a5-5eb0801102cd', 'lutinabeats@gmail.com', 'berton.lutina@hotmail.com', '✅ Match Accepted: Lyano24 vs Lutina_17', 'Lutina_17 has accepted your match invitation!\n\nDate: 09/05/2026 15:30:00\n\nThe match has been added to your schedule.', 'match_invite_response', 'pending', 1, NULL, NULL, '2026-05-06 06:17:21', 'none', NULL, NULL, NULL, NULL, 0),
('e6366979-d1ed-4c50-aa69-682752952f97', 'berton.lutina@gmail.com', 'emmanuel.kalonji@hotmail.com', '❌ Match Declined: Andreas24 vs lengarose', 'lengarose has declined your match invitation.', 'match_invite_response', 'pending', 0, NULL, NULL, '2026-05-07 12:40:08', 'none', 'lengarose', 'https://stageleagues.com/uploads/58584e68-6304-4d03-b8a7-a6ca4b6c3ced.PNG', NULL, NULL, 0),
('fdec4b40-0adb-4e54-aea3-a144ddd71bd4', 'lutinabeats@gmail.com', 'berton.lutina@hotmail.com', '✅ Match Accepted: undefined vs undefined', 'undefined has accepted your match invitation!\n\nDate: TBD\n\nThe match has been added to your schedule.', 'match_invite_response', 'pending', 1, NULL, NULL, '2026-05-06 05:54:45', NULL, NULL, NULL, NULL, NULL, 0);

-- --------------------------------------------------------

--
-- Structure de la table `join_requests`
--

CREATE TABLE `join_requests` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `player_gamertag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `join_requests`
--

INSERT INTO `join_requests` (`id`, `player_id`, `player_email`, `club_id`, `club_name`, `status`, `created_date`, `player_gamertag`, `message`) VALUES
('386c3098-636a-4675-854b-5fe7c72d8907', 'd759e668-82a0-4ba8-bb55-25decc217e97', 'berton.lutina@hotmail.com', '08c23670-f6d1-4847-ab5f-5c7c5c016e3d', 'Longue Vie F.C.', 'pending', '2026-05-06 17:58:33', NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `landing_config`
--

CREATE TABLE `landing_config` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hero_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_description` text COLLATE utf8mb4_unicode_ci,
  `hero_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stats_json` text COLLATE utf8mb4_unicode_ci,
  `section1_tag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section1_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section1_text` text COLLATE utf8mb4_unicode_ci,
  `section1_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section2_tag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section2_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section2_text` text COLLATE utf8mb4_unicode_ci,
  `section2_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section3_tag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section3_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section3_text` text COLLATE utf8mb4_unicode_ci,
  `section3_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `footer_tagline` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `landing_page_contents`
--

CREATE TABLE `landing_page_contents` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hero_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_subtitle` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_description` text COLLATE utf8mb4_unicode_ci,
  `hero_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_1_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_1_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_2_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_2_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_3_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_cta_3_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section1_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section1_text` text COLLATE utf8mb4_unicode_ci,
  `section1_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section2_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section2_text` text COLLATE utf8mb4_unicode_ci,
  `section2_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section3_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section3_text` text COLLATE utf8mb4_unicode_ci,
  `section3_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `faq_items` longtext COLLATE utf8mb4_unicode_ci,
  `contact_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `footer_tagline` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `stats_json` text COLLATE utf8mb4_unicode_ci,
  `section1_tag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section2_tag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section3_tag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `landing_page_contents`
--

INSERT INTO `landing_page_contents` (`id`, `hero_title`, `hero_subtitle`, `hero_description`, `hero_image_url`, `hero_cta_1_label`, `hero_cta_1_url`, `hero_cta_2_label`, `hero_cta_2_url`, `hero_cta_3_label`, `hero_cta_3_url`, `section1_title`, `section1_text`, `section1_image_url`, `section2_title`, `section2_text`, `section2_image_url`, `section3_title`, `section3_text`, `section3_image_url`, `faq_items`, `contact_email`, `footer_tagline`, `created_date`, `updated_date`, `stats_json`, `section1_tag`, `section2_tag`, `section3_tag`) VALUES
('0ccb79a9-6c31-485d-8185-bfdafef454be', 'The Competitive EA FC Platform', NULL, 'Leagues, competitions, clubs, contracts, and a community — everything the serious EA FC player needs, all in one place.', 'https://stageleagues.com/uploads/ce781c84-daac-4274-b4a8-6baacd9256cf.png', NULL, NULL, NULL, NULL, NULL, NULL, 'Structured Leagues & Competitions', 'STAGE runs official regional leagues and knockout competitions throughout the year. Register your club, play your fixtures on Game Day, and climb the table. Seasons end with trophies, prize pools, and promotion — building a history your club can be proud of.', 'https://stageleagues.com/uploads/16cf94b7-d4de-44d5-8ab0-dbd3d6cb2e83.PNG', 'Your Club, Your Rules', 'Every great club starts with a vision. Set your formation, manage your transfer and wage budget in STC, sign players to proper contracts, and watch your squad grow. Upgrade your stadium capacity, fill your trophy cabinet, and lead your club to the top of the rankings.', 'https://stageleagues.com/uploads/a02e517d-d544-40de-aec4-599b1b8dc80e.PNG', 'Build a Career Worth Watching', 'Create a player profile, get scouted, and sign for a club that fits your ambitions. Every goal, assist, and rating update is tracked. Climb the free agent board, negotiate your next contract, and spend your earnings on lifestyle items that show off your status off the pitch.', 'https://stageleagues.com/uploads/7fdd23ec-2364-4420-b7a7-61fa5c60af37.PNG', '[]', NULL, '', '2026-05-08 09:27:56', '2026-05-08 09:27:56', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `league_entities`
--

CREATE TABLE `league_entities` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data_json` mediumtext COLLATE utf8mb4_unicode_ci,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduling_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `league_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `tier` int DEFAULT NULL,
  `division` int DEFAULT NULL,
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_number` int DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `league_entities`
--

INSERT INTO `league_entities` (`id`, `entity_type`, `data_json`, `status`, `scheduling_status`, `slug`, `league_id`, `season_id`, `competition_id`, `club_id`, `is_active`, `tier`, `division`, `region`, `platform`, `season_number`, `created_date`, `updated_date`) VALUES
('01bf3f43-cbc4-4178-9608-c54955334b3e', 'regional_league', '{\"name\":\"STAGE Benelux Pro League\",\"slug\":\"benelux-div-1\",\"region_slug\":\"benelux\",\"division\":1,\"region\":\"Europe\",\"country_code\":\"BE\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":6,\"id\":\"01bf3f43-cbc4-4178-9608-c54955334b3e\",\"created_date\":\"2026-05-11T14:09:37.000Z\",\"updated_date\":\"2026-05-11T21:05:15.000Z\",\"registered_club_ids\":[\"9ae52991-60be-4309-a28e-f7c16f23b0e5\"],\"num_clubs\":1,\"trophy_image_url\":\"https://stageleagues.com/uploads/9cfd1a41-2cc5-4e2e-9a6e-fecf550e952f.PNG\"}', 'registration', NULL, 'benelux-div-1', NULL, NULL, NULL, NULL, NULL, NULL, 1, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-13 20:49:14'),
('0b3fdfa8-6b46-49c7-943b-cea9b211963f', 'regional_league_standing', '{\"league_id\":\"01bf3f43-cbc4-4178-9608-c54955334b3e\",\"league_name\":\"STAGE Benelux Pro League\",\"region_slug\":\"benelux\",\"division\":1,\"season_number\":1,\"club_id\":\"9ae52991-60be-4309-a28e-f7c16f23b0e5\",\"club_name\":\"Zaire\",\"club_logo_url\":\"\",\"club_tag\":\"ZAZA\",\"platform\":\"Cross-Platform\",\"region\":\"Europe\",\"position\":1,\"played\":0,\"wins\":0,\"draws\":0,\"losses\":0,\"goals_for\":0,\"goals_against\":0,\"goal_difference\":0,\"points\":0,\"id\":\"0b3fdfa8-6b46-49c7-943b-cea9b211963f\"}', NULL, NULL, NULL, '01bf3f43-cbc4-4178-9608-c54955334b3e', NULL, NULL, '9ae52991-60be-4309-a28e-f7c16f23b0e5', NULL, NULL, 1, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:54:12', '2026-05-11 14:54:12'),
('12a13023-1af8-48a6-af25-89565af45709', 'competition', '{\"name\":\"STAGE Challenger League\",\"slug\":\"challenger\",\"tier\":3,\"primary_color\":\"#A78BFA\",\"description\":\"Where every STAGE career begins. Rise through the ranks.\",\"max_clubs_per_season\":36,\"promotion_spots\":0,\"relegation_spots\":0,\"playoff_spots\":4,\"qualification_spots_per_region\":3,\"current_season\":1,\"is_active\":1,\"platform\":\"Cross-Platform\",\"region\":\"Global\",\"id\":\"12a13023-1af8-48a6-af25-89565af45709\",\"created_date\":\"2026-05-11T13:58:31.000Z\",\"updated_date\":\"2026-05-13T20:49:34.000Z\",\"trophy_image_url\":\"https://stageleagues.com/uploads/8bd146c7-dbe3-4797-b1ac-7d03b72a334b.PNG\"}', NULL, NULL, 'challenger', NULL, NULL, NULL, NULL, 1, 3, NULL, 'Global', 'Cross-Platform', NULL, '2026-05-11 13:58:31', '2026-05-15 19:36:21'),
('4cab88e3-6fc4-4f2d-9b1d-c5af8cdd5ecd', 'season_registration', '{\"club_id\":\"2df50dab-b2b1-4106-9502-cd2437640ab6\",\"club_name\":\"Longue Vie FC\",\"club_tag\":\"FLV\",\"club_logo_url\":\"https://stageleagues.com/uploads/5a123b76-ad9a-4ecc-9a42-efe969768cc8.PNG\",\"owner_email\":\"emmanuel.kalonji@hotmail.com\",\"target_type\":\"regional_league\",\"region_slug\":\"benelux\",\"region_name\":\"Benelux\",\"platform\":\"PlayStation\",\"preferred_division\":2,\"note_from_club\":\"\",\"season_label\":\"Season 1\",\"status\":\"approved\",\"applied_at\":\"2026-05-11T14:16:40.599Z\",\"id\":\"4cab88e3-6fc4-4f2d-9b1d-c5af8cdd5ecd\",\"created_date\":\"2026-05-11T14:16:40.000Z\",\"updated_date\":\"2026-05-11T14:16:40.000Z\",\"assigned_league_id\":\"e458dfdc-9daa-41b9-9b8f-66a04e411c31\",\"assigned_league_name\":\"STAGE Benelux Division 2\",\"assigned_division\":2,\"reviewed_by\":\"krikke\",\"reviewed_at\":\"2026-05-11T14:17:47.272Z\"}', 'approved', NULL, NULL, NULL, NULL, NULL, '2df50dab-b2b1-4106-9502-cd2437640ab6', NULL, NULL, NULL, NULL, 'PlayStation', NULL, '2026-05-11 14:16:40', '2026-05-11 14:17:47'),
('4d7acc11-dc87-4eb3-b835-057cf00b5d40', 'regional_league', '{\"name\":\"STAGE La Liga de España\",\"slug\":\"spain-div-1\",\"region_slug\":\"spain\",\"division\":1,\"region\":\"Europe\",\"country_code\":\"ES\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":6,\"id\":\"4d7acc11-dc87-4eb3-b835-057cf00b5d40\",\"created_date\":\"2026-05-11T14:09:37.000Z\",\"updated_date\":\"2026-05-11T21:07:41.000Z\",\"trophy_image_url\":\"https://stageleagues.com/uploads/bd20cead-24f9-44e4-aad9-73fe9dd7d5b6.PNG\"}', 'registration', NULL, 'spain-div-1', NULL, NULL, NULL, NULL, NULL, NULL, 1, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-13 20:48:48'),
('5dc52d31-66ee-48b6-ac27-434090e3caef', 'regional_league', '{\"name\":\"STAGE North American Division 2\",\"slug\":\"north-america-div-2\",\"region_slug\":\"north-america\",\"division\":2,\"region\":\"North America\",\"country_code\":\"US\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":2,\"id\":\"5dc52d31-66ee-48b6-ac27-434090e3caef\"}', 'registration', NULL, 'north-america-div-2', NULL, NULL, NULL, NULL, NULL, NULL, 2, 'North America', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-11 14:09:37'),
('670a2e85-2da4-41ab-af4f-355157b7bfa6', 'regional_league', '{\"name\":\"STAGE Deutsche Liga\",\"slug\":\"germany-div-1\",\"region_slug\":\"germany\",\"division\":1,\"region\":\"Europe\",\"country_code\":\"DE\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":6,\"id\":\"670a2e85-2da4-41ab-af4f-355157b7bfa6\",\"created_date\":\"2026-05-11T14:09:37.000Z\",\"updated_date\":\"2026-05-11T21:06:11.000Z\",\"trophy_image_url\":\"https://stageleagues.com/uploads/ec66d78c-df39-47d7-9f3b-5bb173e75364.PNG\"}', 'registration', NULL, 'germany-div-1', NULL, NULL, NULL, NULL, NULL, NULL, 1, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-13 20:49:56'),
('72ab7e66-d33f-4d1b-af21-446441acb1f7', 'regional_league', '{\"name\":\"STAGE Division 2\",\"slug\":\"france-div-2\",\"region_slug\":\"france\",\"division\":2,\"region\":\"Europe\",\"country_code\":\"FR\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":2,\"id\":\"72ab7e66-d33f-4d1b-af21-446441acb1f7\"}', 'registration', NULL, 'france-div-2', NULL, NULL, NULL, NULL, NULL, NULL, 2, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-11 14:09:37'),
('88f1c789-68cf-4eea-9672-7873e5f1ac24', 'regional_league', '{\"name\":\"STAGE Deutsche Liga 2\",\"slug\":\"germany-div-2\",\"region_slug\":\"germany\",\"division\":2,\"region\":\"Europe\",\"country_code\":\"DE\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":2,\"id\":\"88f1c789-68cf-4eea-9672-7873e5f1ac24\"}', 'registration', NULL, 'germany-div-2', NULL, NULL, NULL, NULL, NULL, NULL, 2, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-11 14:09:37'),
('8c2bdc02-80c5-4322-865f-a10a8e8d97f5', 'regional_league', '{\"name\":\"STAGE La Liga 2\",\"slug\":\"spain-div-2\",\"region_slug\":\"spain\",\"division\":2,\"region\":\"Europe\",\"country_code\":\"ES\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":2,\"id\":\"8c2bdc02-80c5-4322-865f-a10a8e8d97f5\"}', 'registration', NULL, 'spain-div-2', NULL, NULL, NULL, NULL, NULL, NULL, 2, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-11 14:09:37'),
('9604d5ef-cf1e-454d-8bec-ff022bb0f213', 'season_registration', '{\"club_id\":\"9ae52991-60be-4309-a28e-f7c16f23b0e5\",\"club_name\":\"Zaire\",\"club_tag\":\"ZAZA\",\"club_logo_url\":\"\",\"owner_email\":\"berton.lutina@hotmail.com\",\"target_type\":\"regional_league\",\"region_slug\":\"benelux\",\"region_name\":\"Benelux\",\"platform\":\"PlayStation\",\"preferred_division\":1,\"note_from_club\":\"\",\"season_label\":\"Season 1\",\"status\":\"approved\",\"applied_at\":\"2026-05-11T14:52:16.613Z\",\"id\":\"9604d5ef-cf1e-454d-8bec-ff022bb0f213\",\"created_date\":\"2026-05-11T14:52:16.000Z\",\"updated_date\":\"2026-05-11T14:52:16.000Z\",\"assigned_league_id\":\"01bf3f43-cbc4-4178-9608-c54955334b3e\",\"assigned_league_name\":\"STAGE Benelux Pro League\",\"assigned_division\":1,\"reviewed_by\":\"creaafde@hotmail.com\",\"reviewed_at\":\"2026-05-11T14:54:12.712Z\"}', 'approved', NULL, NULL, NULL, NULL, NULL, '9ae52991-60be-4309-a28e-f7c16f23b0e5', NULL, NULL, NULL, NULL, 'PlayStation', NULL, '2026-05-11 14:52:16', '2026-05-11 14:54:12'),
('c2d6e60f-89e0-4813-81a1-967551d8d69f', 'regional_league', '{\"name\":\"STAGE Premier Division\",\"slug\":\"uk-ireland-div-1\",\"region_slug\":\"uk-ireland\",\"division\":1,\"region\":\"Europe\",\"country_code\":\"GB\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":6,\"id\":\"c2d6e60f-89e0-4813-81a1-967551d8d69f\",\"created_date\":\"2026-05-11T14:09:37.000Z\",\"updated_date\":\"2026-05-11T15:25:18.000Z\",\"trophy_image_url\":\"https://stageleagues.com/uploads/1f16a9c6-a74c-4135-a09f-ae66fb8b205f.PNG\"}', 'registration', NULL, 'uk-ireland-div-1', NULL, NULL, NULL, NULL, NULL, NULL, 1, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-13 20:49:05'),
('c822df55-5118-4334-be93-04554b90b500', 'regional_league', '{\"name\":\"STAGE Championship\",\"slug\":\"uk-ireland-div-2\",\"region_slug\":\"uk-ireland\",\"division\":2,\"region\":\"Europe\",\"country_code\":\"GB\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":2,\"id\":\"c822df55-5118-4334-be93-04554b90b500\"}', 'registration', NULL, 'uk-ireland-div-2', NULL, NULL, NULL, NULL, NULL, NULL, 2, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-11 14:09:37'),
('c8eafddc-e09d-4b3e-b300-00b9b1d5eeb5', 'competition', '{\"name\":\"STAGE Elite League\",\"slug\":\"elite\",\"tier\":2,\"primary_color\":\"#00E5BD\",\"description\":\"The proving ground. Earn your place in the Supreme League.\",\"max_clubs_per_season\":36,\"promotion_spots\":0,\"relegation_spots\":0,\"playoff_spots\":4,\"qualification_spots_per_region\":2,\"current_season\":1,\"is_active\":1,\"platform\":\"Cross-Platform\",\"region\":\"Global\",\"id\":\"c8eafddc-e09d-4b3e-b300-00b9b1d5eeb5\",\"created_date\":\"2026-05-11T13:58:31.000Z\",\"updated_date\":\"2026-05-13T20:49:46.000Z\",\"trophy_image_url\":\"https://stageleagues.com/uploads/0c696b9e-d38b-4055-b8f1-382b8c104f2c.PNG\"}', NULL, NULL, 'elite', NULL, NULL, NULL, NULL, 1, 2, NULL, 'Global', 'Cross-Platform', NULL, '2026-05-11 13:58:31', '2026-05-15 19:36:09'),
('d70b1337-849f-456c-a5fa-c133d8496fc9', 'competition', '{\"name\":\"STAGE Supreme League\",\"slug\":\"supreme\",\"tier\":1,\"primary_color\":\"#FFD700\",\"description\":\"The pinnacle of STAGE competition. Only the elite qualify.\",\"max_clubs_per_season\":36,\"promotion_spots\":0,\"relegation_spots\":0,\"playoff_spots\":4,\"qualification_spots_per_region\":2,\"current_season\":1,\"is_active\":1,\"platform\":\"Cross-Platform\",\"region\":\"Global\",\"id\":\"d70b1337-849f-456c-a5fa-c133d8496fc9\",\"created_date\":\"2026-05-11T13:58:31.000Z\",\"updated_date\":\"2026-05-13T21:49:08.000Z\",\"trophy_image_url\":\"https://stageleagues.com/uploads/87f7f77f-c41a-45ae-9d3f-9446b5e59a39.PNG\"}', NULL, NULL, 'supreme', NULL, NULL, NULL, NULL, 1, 1, NULL, 'Global', 'Cross-Platform', NULL, '2026-05-11 13:58:31', '2026-05-15 19:35:59'),
('e458dfdc-9daa-41b9-9b8f-66a04e411c31', 'regional_league', '{\"name\":\"STAGE Benelux Division 2\",\"slug\":\"benelux-div-2\",\"region_slug\":\"benelux\",\"division\":2,\"region\":\"Europe\",\"country_code\":\"BE\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":2,\"id\":\"e458dfdc-9daa-41b9-9b8f-66a04e411c31\",\"created_date\":\"2026-05-11T14:09:37.000Z\",\"updated_date\":\"2026-05-11T14:09:37.000Z\",\"registered_club_ids\":[\"2df50dab-b2b1-4106-9502-cd2437640ab6\"],\"num_clubs\":1}', 'registration', NULL, 'benelux-div-2', NULL, NULL, NULL, NULL, NULL, NULL, 2, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-11 14:17:47'),
('e91c6c27-4fd2-45d9-b6ed-6a3591d7b210', 'regional_league', '{\"name\":\"STAGE North American League\",\"slug\":\"north-america-div-1\",\"region_slug\":\"north-america\",\"division\":1,\"region\":\"North America\",\"country_code\":\"US\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":6,\"id\":\"e91c6c27-4fd2-45d9-b6ed-6a3591d7b210\"}', 'registration', NULL, 'north-america-div-1', NULL, NULL, NULL, NULL, NULL, NULL, 1, 'North America', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-11 14:09:37'),
('fa616013-3338-4e03-b86e-c5ea92364c43', 'regional_league', '{\"name\":\"STAGE Division 1\",\"slug\":\"france-div-1\",\"region_slug\":\"france\",\"division\":1,\"region\":\"Europe\",\"country_code\":\"FR\",\"platform\":\"Cross-Platform\",\"season_number\":1,\"status\":\"registration\",\"max_clubs\":16,\"promoted_slots\":6,\"id\":\"fa616013-3338-4e03-b86e-c5ea92364c43\"}', 'registration', NULL, 'france-div-1', NULL, NULL, NULL, NULL, NULL, NULL, 1, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:09:37', '2026-05-11 14:09:37'),
('fe1f39c3-c070-4fc7-ae82-6555263d1bf3', 'regional_league_standing', '{\"league_id\":\"e458dfdc-9daa-41b9-9b8f-66a04e411c31\",\"league_name\":\"STAGE Benelux Division 2\",\"region_slug\":\"benelux\",\"division\":2,\"season_number\":1,\"club_id\":\"2df50dab-b2b1-4106-9502-cd2437640ab6\",\"club_name\":\"Longue Vie FC\",\"club_logo_url\":\"https://stageleagues.com/uploads/5a123b76-ad9a-4ecc-9a42-efe969768cc8.PNG\",\"club_tag\":\"FLV\",\"platform\":\"Cross-Platform\",\"region\":\"Europe\",\"position\":1,\"played\":0,\"wins\":0,\"draws\":0,\"losses\":0,\"goals_for\":0,\"goals_against\":0,\"goal_difference\":0,\"points\":0,\"id\":\"fe1f39c3-c070-4fc7-ae82-6555263d1bf3\"}', NULL, NULL, NULL, 'e458dfdc-9daa-41b9-9b8f-66a04e411c31', NULL, NULL, '2df50dab-b2b1-4106-9502-cd2437640ab6', NULL, NULL, 2, 'Europe', 'Cross-Platform', 1, '2026-05-11 14:17:47', '2026-05-11 14:17:47');

-- --------------------------------------------------------

--
-- Structure de la table `lifestyle_items`
--

CREATE TABLE `lifestyle_items` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `category` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subcategory` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price_stc` bigint DEFAULT '0',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tier` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'standard',
  `rent_price_stc` bigint DEFAULT '0',
  `rent_duration_days` int DEFAULT '30',
  `invest_price_stc` bigint DEFAULT '0',
  `invest_return_rate` decimal(5,2) DEFAULT '0.00',
  `invest_duration_days` int DEFAULT '30',
  `passive_income_stc` bigint DEFAULT '0',
  `passive_income_interval_days` int DEFAULT '7',
  `weekly_maintenance_stc` bigint DEFAULT '0',
  `can_buy` tinyint(1) DEFAULT '1',
  `can_rent` tinyint(1) DEFAULT '0',
  `can_invest` tinyint(1) DEFAULT '0',
  `can_sell` tinyint(1) DEFAULT '1',
  `sell_value_percent` int DEFAULT '60',
  `allows_multiple` tinyint(1) DEFAULT '1',
  `emoji` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `lifestyle_purchases`
--

CREATE TABLE `lifestyle_purchases` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_tier` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rent_active` tinyint(1) DEFAULT '0',
  `is_residence` tinyint(1) DEFAULT '0',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `player_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_gamertag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'buy',
  `price_paid_stc` bigint DEFAULT '0',
  `rent_end_date` datetime DEFAULT NULL,
  `invest_end_date` datetime DEFAULT NULL,
  `invest_return_amount` bigint DEFAULT '0',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `current_value_stc` bigint DEFAULT '0',
  `upgrade_level` int DEFAULT '0',
  `last_passive_collected` datetime DEFAULT NULL,
  `base_upgrade_cost_stc` bigint DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `live_matches`
--

CREATE TABLE `live_matches` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `match_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_score` int DEFAULT '0',
  `away_score` int DEFAULT '0',
  `minute` int DEFAULT '0',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'live',
  `events` json DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `home_club_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_player_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_player_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `live_match_events`
--

CREATE TABLE `live_match_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `live_match_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scorer_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scorer_gamertag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assist_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assist_gamertag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_penalty` tinyint(1) DEFAULT '0',
  `is_own_goal` tinyint(1) DEFAULT '0',
  `minute` int DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `market_value_config`
--

CREATE TABLE `market_value_config` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'default',
  `weights` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `market_value_config`
--

INSERT INTO `market_value_config` (`id`, `name`, `weights`, `is_active`, `created_date`, `updated_date`) VALUES
('41b584da-4c17-47c1-9df7-1ed9612c2f4e', 'default', '{\"max_base\": 8000000, \"form_boost\": 0.2, \"motm_bonus\": 300000, \"ovr_weight\": 0.08, \"form_penalty\": 0.12, \"spike_cap_up\": 0.5, \"base_per_match\": 60000, \"spike_cap_down\": 0.35, \"win_rate_boost\": 0.1, \"goal_rate_bonus\": 2000000, \"assist_rate_bonus\": 1000000, \"consistency_boost\": 0.15, \"clean_sheet_rate_bonus\": 2500000}', 1, '2026-05-11 13:56:35', '2026-05-11 13:56:35');

-- --------------------------------------------------------

--
-- Structure de la table `matches`
--

CREATE TABLE `matches` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `home_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_club_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_score` int DEFAULT '0',
  `away_score` int DEFAULT '0',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'scheduled',
  `mode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `round` int DEFAULT NULL,
  `tournament_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduled_date` datetime DEFAULT NULL,
  `wager_stc` decimal(12,2) DEFAULT '0.00',
  `wager_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wager_home_locked` tinyint(1) DEFAULT '0',
  `wager_away_locked` tinyint(1) DEFAULT '0',
  `stream_url` text COLLATE utf8mb4_unicode_ci,
  `stream_embed_html` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `source_fixture_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_fixture_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_context` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_goal_events` json DEFAULT NULL,
  `away_goal_events` json DEFAULT NULL,
  `home_player_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_player_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stats_processed` tinyint(1) DEFAULT '0',
  `winner_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_club_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_player_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `loser_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `loser_club_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `loser_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `loser_player_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_number` int DEFAULT NULL,
  `bracket_side` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_player_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_player_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_home_submitted` tinyint(1) DEFAULT '0',
  `result_away_submitted` tinyint(1) DEFAULT '0',
  `home_submission` text COLLATE utf8mb4_unicode_ci,
  `away_submission` text COLLATE utf8mb4_unicode_ci,
  `home_ticket_revenue` decimal(12,2) DEFAULT '0.00',
  `home_ticket_attendance` int DEFAULT '0',
  `home_ticket_capacity` int DEFAULT '0',
  `home_ticket_price` decimal(8,2) DEFAULT '0.00',
  `home_ticket_pct` tinyint DEFAULT '0',
  `home_submitted_score` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_submitted_score` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_submission_at` datetime DEFAULT NULL,
  `first_submitter_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `video_url` text COLLATE utf8mb4_unicode_ci,
  `proof_url` text COLLATE utf8mb4_unicode_ci,
  `home_stream_url` text COLLATE utf8mb4_unicode_ci,
  `away_stream_url` text COLLATE utf8mb4_unicode_ci,
  `forfeit_claimed_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `forfeit_proof_url` text COLLATE utf8mb4_unicode_ci,
  `forfeit_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_notes` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `wager_home_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wager_away_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ;

--
-- Déchargement des données de la table `matches`
--

INSERT INTO `matches` (`id`, `home_club_id`, `away_club_id`, `home_player_id`, `away_player_id`, `home_club_name`, `away_club_name`, `home_score`, `away_score`, `status`, `mode`, `type`, `round`, `tournament_id`, `scheduled_date`, `wager_stc`, `wager_status`, `wager_home_locked`, `wager_away_locked`, `stream_url`, `stream_embed_html`, `created_date`, `updated_date`, `source_fixture_id`, `source_fixture_type`, `competition_context`, `home_goal_events`, `away_goal_events`, `home_player_name`, `away_player_name`, `stats_processed`, `winner_club_id`, `winner_club_name`, `winner_player_id`, `winner_player_name`, `loser_club_id`, `loser_club_name`, `loser_player_id`, `loser_player_name`, `group_number`, `bracket_side`, `home_player_email`, `away_player_email`, `result_home_submitted`, `result_away_submitted`, `home_submission`, `away_submission`, `home_ticket_revenue`, `home_ticket_attendance`, `home_ticket_capacity`, `home_ticket_price`, `home_ticket_pct`, `home_submitted_score`, `away_submitted_score`, `first_submission_at`, `first_submitter_club_id`, `video_url`, `proof_url`, `home_stream_url`, `away_stream_url`, `forfeit_claimed_by`, `forfeit_proof_url`, `forfeit_status`, `admin_notes`, `notes`, `wager_home_player_id`, `wager_away_player_id`) VALUES
('83fb80ae-5269-447b-a464-322de2ac62fc', NULL, NULL, 'd759e668-82a0-4ba8-bb55-25decc217e97', '153014cd-f6b7-4a59-8d38-5b52c06e5863', NULL, NULL, NULL, NULL, 'scheduled', 'solo', NULL, NULL, NULL, '2026-05-08 23:20:00', 20000.00, 'active', 1, 1, NULL, NULL, '2026-05-07 11:17:19', '2026-05-11 23:24:16', NULL, NULL, NULL, NULL, NULL, 'Lutina_17', 'Lyano24', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, NULL, 0.00, 0, 0, 0.00, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('9a3e8fb8-958e-432d-9e97-55645af3fd94', NULL, NULL, '153014cd-f6b7-4a59-8d38-5b52c06e5863', 'd759e668-82a0-4ba8-bb55-25decc217e97', NULL, NULL, NULL, NULL, 'scheduled', 'solo', NULL, NULL, NULL, '2026-05-08 21:20:00', 30000.00, 'active', 1, 1, NULL, '<!-- Add a placeholder for the Twitch embed -->\n<div id=\"twitch-embed\"></div>\n\n<!-- Load the Twitch embed script -->\n<script src=\"https://player.twitch.tv/js/embed/v1.js\"></script>\n\n<!-- Create a Twitch.Player object. This will render within the placeholder div -->\n<script type=\"text/javascript\">\n  new Twitch.Player(\"twitch-embed\", {\n    channel: \"stokes\"\n  });\n</script>', '2026-05-08 19:16:27', '2026-05-11 23:24:21', NULL, NULL, NULL, NULL, NULL, 'Lyano24', 'Lutina_17', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, NULL, 0.00, 0, 0, 0.00, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `match_player_stats`
--

CREATE TABLE `match_player_stats` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `match_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tournament_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `goals` int DEFAULT '0',
  `assists` int DEFAULT '0',
  `rating` decimal(3,1) DEFAULT '0.0',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `player_gamertag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `own_goals` int DEFAULT '0',
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ;

-- --------------------------------------------------------

--
-- Structure de la table `news_items`
--

CREATE TABLE `news_items` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `link` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `published_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'announcement',
  `category` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `image_url` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `notifications`
--

CREATE TABLE `notifications` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `read` tinyint(1) DEFAULT '0',
  `link` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `related_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ;

--
-- Déchargement des données de la table `notifications`
--

INSERT INTO `notifications` (`id`, `recipient_email`, `type`, `title`, `body`, `read`, `link`, `created_date`, `related_id`) VALUES
('0e7c6e19-35cd-4eaa-9d1d-56e457a5ebf2', 'berton.lutina@hotmail.com', 'tournament_start', 'Your club registered for STAGE Supreme League', 'Your club has signed up for STAGE Supreme League.\n📅 Start: 13 May 2026, 22:00\nPlatform: PlayStation\nMake sure you\'re ready!', 1, '/tournaments/86d5672d-4bcb-4277-8d70-4f30a14c4908', '2026-05-11 23:16:49', '86d5672d-4bcb-4277-8d70-4f30a14c4908'),
('10115aa2-f8d8-409f-9e21-ed9e2051c782', 'lutinabeats@gmail.com', 'contract_offer', '📋 Trial Contract Offer from Zaire', 'Zaire has sent you a trial contract offer. Open your inbox to review.', 1, '/inbox', '2026-05-08 15:27:52', NULL),
('11aec6c2-ebf9-4e9f-999a-de2a29d4ba52', 'emmanuel.kalonji@hotmail.com', 'tournament_start', 'Your club registered for STAGE Weekend League', 'Your club has signed up for STAGE Weekend League.\nStart: 14 May 2026, 19:00\nPlatform: PlayStation\nMake sure you\'re ready!', 1, '/tournaments/68d99492-5fae-4308-a3c3-b71cf0b0d05a', '2026-05-14 18:00:40', '68d99492-5fae-4308-a3c3-b71cf0b0d05a'),
('127f0405-234a-484a-b8c5-e64f2d3b0cf8', 'creaafde@hotmail.com', 'identity_claim', 'New identity claim', 'Lengarose submitted a PlayStation identity claim.', 1, '/admin/identity-claims', '2026-05-15 14:30:20', NULL),
('150c4ea8-60ce-4d18-a820-0c800474a099', 'berton.lutina@hotmail.com', 'match_scheduled', '✅ Match Invitation Accepted', 'Lyano24 has accepted your match invitation for 8-5-2026.', 1, '/schedule', '2026-05-07 11:17:19', NULL),
('15abf2d3-8295-4951-b327-f90f712df421', 'emmanuel.kalonji@hotmail.com', 'tournament_start', 'Your club registered for STAGE Supreme League', 'Your club has signed up for STAGE Supreme League.\n📅 Start: 13 May 2026, 22:00\nPlatform: PlayStation\nMake sure you\'re ready!', 1, '/tournaments/86d5672d-4bcb-4277-8d70-4f30a14c4908', '2026-05-11 23:14:02', '86d5672d-4bcb-4277-8d70-4f30a14c4908'),
('1e44415d-4b01-4845-8781-976f34b55d0a', 'emmanuel.kalonji@hotmail.com', 'contract_offer', '📋 Contract Offer from Longue Vie FC', 'Longue Vie FC has sent you a ownership contract offer. Open your inbox to review the terms.', 1, '/inbox', '2026-05-08 08:33:55', NULL),
('271df72e-3378-4fa9-a353-1bb8a8f18db1', 'lutinabeats@gmail.com', 'match_scheduled', '✅ Match Invitation Accepted', 'Lutina_17 has accepted your match invitation for 08/05/2026.', 1, '/schedule', '2026-05-08 19:16:27', NULL),
('2c120faf-03e9-45fe-bf5b-4ac567de2177', 'berton.lutina@gmail.com', 'match_scheduled', '✅ Match Invitation Accepted', 'lengarose has accepted your match invitation for 07/05/2026.', 1, '/schedule', '2026-05-07 12:40:32', NULL),
('3d9a5e97-f722-4f1e-8162-2c65ac828cca', 'lutinabeats@gmail.com', 'match_scheduled', '⚽ Match Invitation from Lutina_17', 'Lutina_17 wants to play against you on 2026-05-08 at 13:20 — wager: 20 000 STC. Check your inbox to respond.', 1, '/inbox', '2026-05-07 11:16:21', NULL),
('45448d89-0535-4517-9ce3-48f2fa103ab6', 'berton.lutina@hotmail.com', 'match_scheduled', '⚽ Match Invitation from Lyano24', 'Lyano24 wants to play against you on 2026-05-08 at 21:20 — wager: 30.000 STC. Check your inbox to respond.', 1, '/inbox', '2026-05-08 19:15:42', NULL),
('5e49afcc-c1c3-4bb2-b06b-753a48e1b77e', 'emmanuel.kalonji@hotmail.com', 'match_scheduled', '⚽ Match Invitation from Lutina_17', 'Lutina_17 wants to play against you on 2026-05-12 at 10:00 — wager: 50.000 STC. Check your inbox to respond.', 1, '/inbox', '2026-05-11 23:40:11', NULL),
('61760bc8-92c2-4b9d-97a4-369a6b4422f4', 'emmanuel.kalonji@hotmail.com', 'contract_offer', '📋 Contract Offer from Longue Vie FC', 'Longue Vie FC has sent you a star contract offer. Open your inbox to review the terms.', 1, '/inbox', '2026-05-08 08:46:45', NULL),
('6ef44cb9-15fc-4327-93f4-8314c8b506a8', 'krikke', 'identity_claim', 'New identity claim', 'Lengarose submitted a PlayStation identity claim.', 1, '/admin/identity-claims', '2026-05-15 14:30:20', NULL),
('6f6efb2f-23db-484b-afee-eec0d93b3d8c', 'berton.lutina@hotmail.com', 'match_scheduled', '✅ Match Invitation Accepted', 'Lengarose has accepted your match invitation for 12/05/2026.', 1, '/schedule', '2026-05-11 23:42:17', NULL),
('75d45519-d375-44c2-8c5a-25aae0495989', 'berton.lutina@hotmail.com', 'match_result', '❌ Match Invitation Declined', 'Lyano24 has declined your match invitation.', 1, '/inbox', '2026-05-07 11:31:59', NULL),
('7e94a72d-6d77-4bce-bd88-fa44663b000b', 'emmanuel.kalonji@hotmail.com', 'match_scheduled', '⚽ Match Invitation from Andreas24', 'Andreas24 wants to play against you on 2026-05-07 at 14:50 — wager: 20 000 STC. Check your inbox to respond.', 1, '/inbox', '2026-05-07 12:38:40', NULL),
('8f090149-ed1a-4a5e-9c48-a341b5778f83', 'creaafde@hotmail.com', 'identity_claim', 'New identity claim', 'Lutina_17 submitted a PlayStation identity claim.', 1, '/admin/identity-claims', '2026-05-15 19:14:18', NULL),
('993a349e-12d6-4255-a304-5ead71f2aebf', 'lutinabeats@gmail.com', 'contract_offer', '📋 Trial Contract Offer from Zaire', 'Zaire has sent you a trial contract offer. Open your inbox to review.', 1, '/inbox', '2026-05-07 11:32:37', NULL),
('b8f35e82-9ef1-4dce-8558-5c8e7efd2126', 'berton.lutina@hotmail.com', 'match_scheduled', '✅ Match Invitation Accepted', 'Lengarose has accepted your match invitation for 12/05/2026.', 1, '/schedule', '2026-05-11 23:42:21', NULL),
('d1b7cde3-5845-4608-8c79-8fcfde3bf6c2', 'emmanuel.kalonji@hotmail.com', 'match_scheduled', '⚽ Match Invitation from Andreas24', 'Andreas24 wants to play against you on 2026-05-07 at 14:50 — wager: 30 000 STC. Check your inbox to respond.', 1, '/inbox', '2026-05-07 12:37:32', NULL),
('daafa5b7-ea71-496b-a927-04a5c2a57be5', 'chris.dm.kalonji@hotmail.com', 'contract_offer', '📋 Contract Offer from FC Bayern Munich', 'FC Bayern Munich has sent you a ownership contract offer. Open your inbox to review the terms.', 1, '/inbox', '2026-05-08 08:27:08', NULL),
('f85311b4-da7f-4860-9dc2-4e783e6db9dc', 'krikke', 'identity_claim', 'New identity claim', 'Lutina_17 submitted a PlayStation identity claim.', 1, '/admin/identity-claims', '2026-05-15 19:14:18', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `objective_definitions`
--

CREATE TABLE `objective_definitions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'daily',
  `code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `metric` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_value` int NOT NULL DEFAULT '1',
  `reward_stc` decimal(12,2) DEFAULT '0.00',
  `reward_xp` int DEFAULT '0',
  `active_from` datetime DEFAULT NULL,
  `active_until` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `objective_progress`
--

CREATE TABLE `objective_progress` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `objective_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `current_value` int DEFAULT '0',
  `target_value` int DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `claimed_at` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `players`
--

CREATE TABLE `players` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gamertag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bio` text COLLATE utf8mb4_unicode_ci,
  `avatar_url` text COLLATE utf8mb4_unicode_ci,
  `avatar_zoom` int DEFAULT '150',
  `avatar_position` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '50% 50%',
  `shirt_number` int DEFAULT NULL,
  `overall_rating` decimal(4,1) DEFAULT '0.0',
  `goals` int DEFAULT '0',
  `assists` int DEFAULT '0',
  `credits` int DEFAULT '0',
  `subscription` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'rookie',
  `role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dressing_room_seat` int DEFAULT NULL,
  `is_ready` tinyint(1) DEFAULT '0',
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notification_settings` json DEFAULT NULL,
  `club_roles` json DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oauth_provider` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oauth_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_position` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_zoom` int DEFAULT NULL,
  `stc` bigint DEFAULT '0',
  `goals_player` int DEFAULT '0',
  `matches_played` int DEFAULT '0',
  `matches_played_club` int DEFAULT '0',
  `wins_count` int DEFAULT '0',
  `wins_club` int DEFAULT '0',
  `losses_count` int DEFAULT '0',
  `losses_club` int DEFAULT '0',
  `draws_count` int DEFAULT '0',
  `draws_club` int DEFAULT '0',
  `clean_sheets` int DEFAULT '0',
  `man_of_the_match` int DEFAULT '0',
  `avg_match_rating` decimal(4,2) DEFAULT '6.00',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `is_verified` tinyint(1) DEFAULT '0',
  `subscription_expires_at` datetime DEFAULT NULL,
  `subscription_billing` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_subscription_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_player_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `market_value_stc` bigint DEFAULT '250000',
  `form_last10` text COLLATE utf8mb4_unicode_ci,
  `value_updated_at` datetime DEFAULT NULL,
  `archetype` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sacrificed_at` datetime DEFAULT NULL,
  `secondary_position` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verified_platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verified_platform_handle` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `identity_verified_at` datetime DEFAULT NULL
) ;

--
-- Déchargement des données de la table `players`
--

INSERT INTO `players` (`id`, `email`, `gamertag`, `position`, `platform`, `country`, `country_code`, `bio`, `avatar_url`, `avatar_zoom`, `avatar_position`, `shirt_number`, `overall_rating`, `goals`, `assists`, `credits`, `subscription`, `role`, `dressing_room_seat`, `is_ready`, `club_id`, `notification_settings`, `club_roles`, `created_date`, `updated_date`, `password_hash`, `oauth_provider`, `oauth_id`, `user_id`, `banner_url`, `banner_position`, `banner_zoom`, `stc`, `goals_player`, `matches_played`, `matches_played_club`, `wins_count`, `wins_club`, `losses_count`, `losses_club`, `draws_count`, `draws_club`, `clean_sheets`, `man_of_the_match`, `avg_match_rating`, `status`, `is_verified`, `subscription_expires_at`, `subscription_billing`, `stripe_subscription_id`, `stripe_customer_id`, `home_player_email`, `market_value_stc`, `form_last10`, `value_updated_at`, `archetype`, `sacrificed_at`, `secondary_position`, `verified_platform`, `verified_platform_handle`, `identity_verified_at`) VALUES
('153014cd-f6b7-4a59-8d38-5b52c06e5863', 'lutinabeats@gmail.com', 'Lyano24', 'CDM', 'PlayStation', '🇧🇪 Belgium', 'BE', NULL, 'https://stageleagues.com/uploads/a590a1aa-2604-4c22-9f2c-401933d8537e.jpg', 150, '18% 12%', NULL, NULL, NULL, NULL, 200000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-05-06 05:48:23', '2026-05-11 23:41:24', NULL, NULL, NULL, 'c6027070-b11c-4c92-8e34-be84a804f9d8', NULL, NULL, NULL, 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.00, 'active', 0, NULL, NULL, NULL, NULL, NULL, 250000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('433cb010-23d8-41c4-8cdf-6fcab1004602', 'chris.dm.kalonji@hotmail.com', 'DNSTester', 'CAM', 'PlayStation', '🇧🇪 Belgium', 'BE', NULL, 'https://stageleagues.com/uploads/1ad78e0b-b78a-47c1-94db-581502a96a36.PNG', 247, '31% 9%', NULL, NULL, NULL, NULL, 50, NULL, 'president', NULL, NULL, '81ce69e2-5b46-4c68-ba36-af03b70b9709', NULL, '[\"president\"]', '2026-05-08 08:20:52', '2026-05-15 22:32:36', NULL, NULL, NULL, '7aca58a2-c6a8-40a3-870f-a269dff6372d', NULL, NULL, NULL, 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.00, 'active', 0, NULL, NULL, NULL, NULL, NULL, 250000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('97d665c1-a632-4654-b8e0-2c71c75fd6a3', 'berton.lutina@gmail.com', 'Andreas24', 'ST', 'PlayStation', '🇧🇪 Belgium', 'BE', NULL, 'https://stageleagues.com/uploads/97cc4c95-136c-464b-9f49-fd6d31e13100.png', 150, '50% 50%', NULL, NULL, NULL, NULL, 50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-05-07 12:06:01', '2026-05-11 23:41:24', NULL, NULL, NULL, '6c57466b-fb5d-4c32-b9f4-e3739aed2bef', NULL, NULL, NULL, 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.00, 'active', 0, NULL, NULL, NULL, NULL, NULL, 250000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('d759e668-82a0-4ba8-bb55-25decc217e97', 'berton.lutina@hotmail.com', 'Lutina_17', 'ST', 'PlayStation', '🇧🇪 Belgium', 'BE', 'A lethal presence in front of goal, I am a striker for Paris Saint-Germain known for my sharp instincts, explosive pace, and clinical finishing. Thriving under pressure, I specialize in making decisive runs, breaking defensive lines, and converting chances with precision.\n\nMy playing style blends technical skill with physicality—I can hold up play, link with teammates, and create opportunities both inside and outside the box. Whether it’s a quick one-touch finish or a composed strike in a one-on-one situation, I bring consistency and confidence to the attack.\n\nDriven by ambition and a competitive mindset, I aim to contribute to PSG’s dominance at the highest level while continuously refining my game and pushing my limits on the pitch.\n\nIf you want, I can \ntailor it to sound more like a social media bio, FIFA-style profile, or something more personal with your name, number, and backstory.', 'https://stageleagues.com/uploads/01fb2a18-d80d-4794-9a91-4f46730f9ec2.jpg', 150, '50% 50%', 17, 80.0, NULL, NULL, 20000, NULL, 'president', NULL, NULL, '9ae52991-60be-4309-a28e-f7c16f23b0e5', NULL, '[\"president\"]', '2026-05-05 18:33:02', '2026-05-15 22:32:36', NULL, NULL, NULL, '2138f545-75e8-43e4-ad0a-8a1593767c1d', NULL, NULL, NULL, 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.00, 'active', 1, NULL, NULL, NULL, NULL, NULL, 250000, NULL, NULL, NULL, NULL, NULL, 'PlayStation', 'Lutina_17', '2026-05-15 20:28:18');

-- --------------------------------------------------------

--
-- Structure de la table `player_achievements`
--

CREATE TABLE `player_achievements` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_gamertag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_number` int NOT NULL,
  `season_label` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` int DEFAULT NULL,
  `position_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `badge_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'participant',
  `trophy_image_url` text COLLATE utf8mb4_unicode_ci,
  `awarded_at` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `player_contracts`
--

CREATE TABLE `player_contracts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `team_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contract_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `offered_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_games` int DEFAULT NULL,
  `max_days` int DEFAULT NULL,
  `weekly_salary_stc` decimal(12,2) DEFAULT '0.00',
  `signing_bonus_stc` decimal(12,2) DEFAULT '0.00',
  `transfer_fee_stc` decimal(12,2) DEFAULT '0.00',
  `offer_note` text COLLATE utf8mb4_unicode_ci,
  `captaincy_offered` tinyint(1) DEFAULT '0',
  `last_negotiated_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `negotiation_round` int DEFAULT '0',
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `performance_targets` json DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `games_played` int DEFAULT '0',
  `transfer_window_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salary_per_game_stc` bigint DEFAULT '0',
  `is_loan` tinyint(1) DEFAULT '0',
  `loan_return_date` date DEFAULT NULL,
  `last_salary_paid_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `player_contracts`
--

INSERT INTO `player_contracts` (`id`, `team_id`, `user_id`, `contract_type`, `status`, `offered_by`, `max_games`, `max_days`, `weekly_salary_stc`, `signing_bonus_stc`, `transfer_fee_stc`, `offer_note`, `captaincy_offered`, `last_negotiated_by`, `negotiation_round`, `start_date`, `end_date`, `performance_targets`, `created_date`, `updated_date`, `games_played`, `transfer_window_id`, `salary_per_game_stc`, `is_loan`, `loan_return_date`, `last_salary_paid_at`) VALUES
('5468a9a3-fde1-4c3f-abc7-8b8fe0c8d995', '81ce69e2-5b46-4c68-ba36-af03b70b9709', '433cb010-23d8-41c4-8cdf-6fcab1004602', 'ownership', 'pending', '433cb010-23d8-41c4-8cdf-6fcab1004602', 999, 3650, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, NULL, '[]', '2026-05-08 08:27:08', '2026-05-08 08:27:08', 0, NULL, 0, 0, NULL, NULL),
('8f44cd40-5ab9-46a3-923a-8e19020ab430', '9ae52991-60be-4309-a28e-f7c16f23b0e5', '153014cd-f6b7-4a59-8d38-5b52c06e5863', 'trial', 'pending', NULL, 5, 14, 0.00, 0.00, 0.00, 'Trial offer from Zaire in response to your request.', 0, NULL, NULL, NULL, NULL, '[]', '2026-05-08 15:27:52', '2026-05-08 15:27:52', 0, NULL, 0, 0, NULL, NULL),
('b0969e8c-ce9f-4c88-affa-3b45a60487ca', '2df50dab-b2b1-4106-9502-cd2437640ab6', '56f54439-a875-4299-93a0-86b6a3b83dfc', 'ownership', 'pending', '56f54439-a875-4299-93a0-86b6a3b83dfc', 999, 3650, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, NULL, '[]', '2026-05-08 08:33:55', '2026-05-08 08:33:55', 0, NULL, 0, 0, NULL, NULL),
('cc548516-4cb2-4654-9bd8-e481092fd252', '9ae52991-60be-4309-a28e-f7c16f23b0e5', '153014cd-f6b7-4a59-8d38-5b52c06e5863', 'trial', 'pending_window', NULL, 5, 14, 0.00, 0.00, 0.00, 'Trial offer from Zaire in response to your request.', 0, NULL, NULL, NULL, NULL, '[]', '2026-05-07 11:32:37', '2026-05-07 11:33:05', 0, NULL, 0, 0, NULL, NULL),
('d29b1b11-fd7e-4f71-899f-6b7c3074100d', '2df50dab-b2b1-4106-9502-cd2437640ab6', '56f54439-a875-4299-93a0-86b6a3b83dfc', 'star', 'pending', '56f54439-a875-4299-93a0-86b6a3b83dfc', 400, 180, 80000.00, 150000.00, 0.00, '', 1, NULL, NULL, NULL, NULL, '[{\"stat\": \"matches_played\", \"type\": \"min\", \"value\": 380, \"value_max\": 0}, {\"stat\": \"avg_match_rating\", \"type\": \"min\", \"value\": 7.5, \"value_max\": 0}, {\"stat\": \"pass_accuracy_pct\", \"type\": \"min\", \"value\": 90, \"value_max\": 0}, {\"stat\": \"clean_sheets\", \"type\": \"min\", \"value\": 100, \"value_max\": 0}]', '2026-05-08 08:46:45', '2026-05-08 08:46:45', 0, NULL, 0, 0, NULL, NULL),
('f5397e0b-e94f-4522-a19f-9ea3be614fbf', '9ae52991-60be-4309-a28e-f7c16f23b0e5', '153014cd-f6b7-4a59-8d38-5b52c06e5863', 'trial', 'pending_window', NULL, 5, 14, 0.00, 0.00, 0.00, 'Trial offer from Zaire in response to your request.', 0, NULL, NULL, NULL, NULL, '[]', '2026-05-07 05:31:35', '2026-05-07 11:32:11', 0, NULL, 0, 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `player_contract_history`
--

CREATE TABLE `player_contract_history` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contract_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_by` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_note` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `player_identity_claims`
--

CREATE TABLE `player_identity_claims` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gamertag` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform_handle` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ea_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discord_handle` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proof_url` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `review_notes` text COLLATE utf8mb4_unicode_ci,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `reviewed_by` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_by_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `player_identity_claims`
--

INSERT INTO `player_identity_claims` (`id`, `player_id`, `user_id`, `email`, `gamertag`, `platform`, `platform_handle`, `ea_id`, `discord_handle`, `proof_url`, `notes`, `status`, `review_notes`, `rejection_reason`, `reviewed_by`, `reviewed_by_email`, `reviewed_at`, `created_date`, `updated_date`) VALUES
('564f213d-d741-4a33-ad81-f373141ca651', 'd759e668-82a0-4ba8-bb55-25decc217e97', '2138f545-75e8-43e4-ad0a-8a1593767c1d', 'berton.lutina@hotmail.com', 'Lutina_17', 'PlayStation', 'Lutina_17', 'Lutina_17', 'Lutina_17', 'https://stageleagues.com/uploads/0356c83b-2819-4b2f-badf-65246a7966a8.jpeg', 'I m new here', 'approved', 'Verified by admin review', NULL, '9d8ebd1a-3575-4305-b1e4-a91f2ba94c79', 'creaafde@hotmail.com', '2026-05-15 20:28:18', '2026-05-15 19:14:18', '2026-05-15 20:28:18');

-- --------------------------------------------------------

--
-- Structure de la table `player_stc_transactions`
--

CREATE TABLE `player_stc_transactions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `balance_after` decimal(12,2) DEFAULT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `reference_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `player_stc_transactions`
--

INSERT INTO `player_stc_transactions` (`id`, `player_id`, `player_email`, `amount`, `balance_after`, `type`, `category`, `source`, `description`, `reference_id`, `created_date`) VALUES
('19cbaffd-3cde-4adc-8b71-f93931f4d51a', '97d665c1-a632-4654-b8e0-2c71c75fd6a3', 'berton.lutina@gmail.com', 50000.00, 50000.00, 'income', 'initial_grant', 'STAGE', 'Welcome to STAGE — 50,000 STC starting balance', NULL, '2026-05-07 12:06:01'),
('520d79b6-01f9-46e8-ad9c-dd694fe226d4', '433cb010-23d8-41c4-8cdf-6fcab1004602', 'chris.dm.kalonji@hotmail.com', 50000.00, 50000.00, 'income', 'initial_grant', 'STAGE', 'Welcome to STAGE — 50,000 STC starting balance', NULL, '2026-05-08 08:20:52'),
('6478d422-0641-4228-898d-d034da8931b2', '5ca189cf-9980-4275-ac02-d61b3e9eb897', 'fm.chriskalonji@hotmail.com', 50000.00, 50000.00, 'income', 'initial_grant', 'STAGE', 'Welcome to STAGE — 50,000 STC starting balance', NULL, '2026-05-06 07:09:08'),
('6dc22b4a-f50c-450f-b250-d7b0845ac038', '153014cd-f6b7-4a59-8d38-5b52c06e5863', 'lutinabeats@gmail.com', 50000.00, 50000.00, 'income', 'initial_grant', 'STAGE', 'Welcome to STAGE — 50,000 STC starting balance', NULL, '2026-05-06 05:48:23'),
('74b9a4ac-50e5-4ebf-910c-a652456c40b6', '56f54439-a875-4299-93a0-86b6a3b83dfc', 'emmanuel.kalonji@hotmail.com', 50000.00, 50000.00, 'income', 'initial_grant', 'STAGE', 'Welcome to STAGE — 50,000 STC starting balance', NULL, '2026-05-08 08:29:55'),
('cd0cf2d5-fe94-4e6f-8e64-11332c9ab991', 'd759e668-82a0-4ba8-bb55-25decc217e97', 'berton.lutina@hotmail.com', 50000.00, 50000.00, 'income', 'initial_grant', 'STAGE', 'Welcome to STAGE — 50,000 STC starting balance', NULL, '2026-05-05 18:33:02');

-- --------------------------------------------------------

--
-- Structure de la table `posts`
--

CREATE TABLE `posts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_avatar` text COLLATE utf8mb4_unicode_ci,
  `content` text COLLATE utf8mb4_unicode_ci,
  `media_url` text COLLATE utf8mb4_unicode_ci,
  `media_cover_url` text COLLATE utf8mb4_unicode_ci,
  `media_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `likes` json DEFAULT NULL,
  `likes_count` int DEFAULT '0',
  `comments_count` int DEFAULT '0',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tournament_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tags` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `predictions`
--

CREATE TABLE `predictions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `live_match_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `predictor_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prediction_score` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `predictor_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `predicted_home_score` int DEFAULT NULL,
  `predicted_away_score` int DEFAULT NULL,
  `predicted_scorer_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `predicted_assist_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `predicted_motm_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `score_correct` tinyint(1) DEFAULT '0',
  `scorer_correct` tinyint(1) DEFAULT '0',
  `assist_correct` tinyint(1) DEFAULT '0',
  `motm_correct` tinyint(1) DEFAULT '0',
  `score_points` int DEFAULT '0',
  `scorer_points` int DEFAULT '0',
  `assist_motm_points` int DEFAULT '0',
  `total_points` int DEFAULT '0',
  `match_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `press_articles`
--

CREATE TABLE `press_articles` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `club_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `player_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_avatar_url` text COLLATE utf8mb4_unicode_ci,
  `link` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `press_conference_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `published_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `headline` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `match_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tournament_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tournament_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `photo_url` text COLLATE utf8mb4_unicode_ci,
  `photo_position` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT '50%% 50%%',
  `photo_zoom` int DEFAULT '120',
  `visibility` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'public',
  `quotes` json DEFAULT NULL,
  `registered_clubs` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `press_conferences`
--

CREATE TABLE `press_conferences` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `match_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `selected_question_ids` json DEFAULT NULL,
  `answers` json DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `context` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'match',
  `tournament_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_avatar_url` text COLLATE utf8mb4_unicode_ci,
  `opponent_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `match_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tournament_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `press_conferences`
--

INSERT INTO `press_conferences` (`id`, `match_id`, `club_id`, `status`, `selected_question_ids`, `answers`, `created_date`, `updated_date`, `context`, `tournament_id`, `club_name`, `club_logo_url`, `player_id`, `player_name`, `player_avatar_url`, `opponent_name`, `match_name`, `tournament_name`) VALUES
('69d5193b9c8effe3f8693956', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f8693956\"]', '{\"category\": \"Mindset\", \"question\": \"How are you feeling before the match?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f8693957', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f8693957\"]', '{\"category\": \"Mindset\", \"question\": \"What\'s the team mindset today?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f8693958', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f8693958\"]', '{\"category\": \"Confidence\", \"question\": \"Are you confident about the result?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f8693959', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f8693959\"]', '{\"category\": \"Strategy\", \"question\": \"What\'s the key to winning today?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f869395a', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f869395a\"]', '{\"category\": \"Opponent\", \"question\": \"Thoughts on your opponent?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f869395b', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f869395b\"]', '{\"category\": \"Mindset\", \"question\": \"Any pressure going into this game?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f869395c', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f869395c\"]', '{\"category\": \"Personal\", \"question\": \"What\'s your personal goal today?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f869395d', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f869395d\"]', '{\"category\": \"Stakes\", \"question\": \"Is this a must-win game?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f869395e', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f869395e\"]', '{\"category\": \"Expectations\", \"question\": \"What do you expect from this match?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f869395f', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f869395f\"]', '{\"category\": \"Preparation\", \"question\": \"How prepared is the team?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f8693960', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f8693960\"]', '{\"category\": \"Team\", \"question\": \"Who will make the difference today?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f8693961', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f8693961\"]', '{\"category\": \"Message\", \"question\": \"Any message for your opponents?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f8693962', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f8693962\"]', '{\"category\": \"Strategy\", \"question\": \"What\'s your strategy?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f8693963', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f8693963\"]', '{\"category\": \"Expectations\", \"question\": \"Are you expecting a high-scoring game?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d5193b9c8effe3f8693964', NULL, NULL, 'pending', '[\"69d5193b9c8effe3f8693964\"]', '{\"category\": \"Stakes\", \"question\": \"What would a win mean?\"}', '2026-04-07 14:48:27', '2026-04-07 14:48:27', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c5b', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c5b\"]', '{\"category\": \"Team\", \"question\": \"What\'s your biggest strength?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c5c', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c5c\"]', '{\"category\": \"Mindset\", \"question\": \"Any weaknesses today?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c5d', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c5d\"]', '{\"category\": \"Stakes\", \"question\": \"How important is this match?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c5e', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c5e\"]', '{\"category\": \"Opponent\", \"question\": \"Are you underestimating the opponent?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c5f', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c5f\"]', '{\"category\": \"Expectations\", \"question\": \"What\'s your prediction?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c60', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c60\"]', '{\"category\": \"Team\", \"question\": \"Who\'s in form right now?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c61', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c61\"]', '{\"category\": \"Mindset\", \"question\": \"What\'s the mood in the team?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c62', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c62\"]', '{\"category\": \"Mindset\", \"question\": \"Are you ready for pressure moments?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c63', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c63\"]', '{\"category\": \"Personal\", \"question\": \"What\'s your biggest motivation?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c64', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c64\"]', '{\"category\": \"Strategy\", \"question\": \"What\'s the plan if things go wrong?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c65', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c65\"]', '{\"category\": \"Strategy\", \"question\": \"Defense or attack more important today?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c66', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c66\"]', '{\"category\": \"Team\", \"question\": \"What makes your team special?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c67', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c67\"]', '{\"category\": \"Opponent\", \"question\": \"Any rivalry in this match?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c68', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c68\"]', '{\"category\": \"Expectations\", \"question\": \"Are you expecting surprises?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51a5e6cf689e78f171c69', NULL, NULL, 'pending', '[\"69d51a5e6cf689e78f171c69\"]', '{\"category\": \"Strategy\", \"question\": \"What\'s your focus point?\"}', '2026-04-07 14:53:18', '2026-04-07 14:53:18', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c9092', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c9092\"]', '{\"category\": \"Mindset\", \"question\": \"How do you handle pressure?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c9093', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c9093\"]', '{\"category\": \"Mindset\", \"question\": \"Any nerves before kickoff?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c9094', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c9094\"]', '{\"category\": \"Preparation\", \"question\": \"What\'s your biggest challenge today?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c9095', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c9095\"]', '{\"category\": \"Strategy\", \"question\": \"What will decide the match?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c9096', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c9096\"]', '{\"category\": \"Expectations\", \"question\": \"Are you expecting extra time?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c9097', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c9097\"]', '{\"category\": \"Mindset\", \"question\": \"What\'s your energy like today?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c9098', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c9098\"]', '{\"category\": \"Message\", \"question\": \"Any last words before kickoff?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c9099', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c9099\"]', '{\"category\": \"Personal\", \"question\": \"What do you want to prove today?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c909a', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c909a\"]', '{\"category\": \"Team\", \"question\": \"How important is teamwork today?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c909b', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c909b\"]', '{\"category\": \"Strategy\", \"question\": \"Are you confident in your tactics?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c909c', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c909c\"]', '{\"category\": \"Team\", \"question\": \"What do you expect from your teammates?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c909d', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c909d\"]', '{\"category\": \"Strategy\", \"question\": \"Are you aiming for a clean sheet?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c909e', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c909e\"]', '{\"category\": \"Team\", \"question\": \"What\'s your biggest advantage?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c909f', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c909f\"]', '{\"category\": \"Mindset\", \"question\": \"What\'s your mindset right now?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c90a0', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c90a0\"]', '{\"category\": \"Strategy\", \"question\": \"What kind of match do you want?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c90a1', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c90a1\"]', '{\"category\": \"Strategy\", \"question\": \"How will you start the game?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c90a2', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c90a2\"]', '{\"category\": \"Message\", \"question\": \"Any message to your fans?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c90a3', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c90a3\"]', '{\"category\": \"Personal\", \"question\": \"What\'s your biggest goal today?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c90a4', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c90a4\"]', '{\"category\": \"Confidence\", \"question\": \"How do you rate your chances?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('69d51b15dfb7623bb60c90a5', NULL, NULL, 'pending', '[\"69d51b15dfb7623bb60c90a5\"]', '{\"category\": \"Confidence\", \"question\": \"Final confidence level?\"}', '2026-04-07 14:56:21', '2026-04-07 14:56:21', 'match', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `press_questions`
--

CREATE TABLE `press_questions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int DEFAULT '0',
  `question` text COLLATE utf8mb4_unicode_ci,
  `answer_a` text COLLATE utf8mb4_unicode_ci,
  `answer_b` text COLLATE utf8mb4_unicode_ci,
  `answer_c` text COLLATE utf8mb4_unicode_ci,
  `answer_d` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `qualification_entries`
--

CREATE TABLE `qualification_entries` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'regional_league',
  `regional_league_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `regional_league_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `regional_finish_position` int DEFAULT NULL,
  `target_competition_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_competition_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_competition_tier` int DEFAULT NULL,
  `target_season_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_season_number` int DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `club_tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `confirmed_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `ranking_configs`
--

CREATE TABLE `ranking_configs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'Default',
  `is_active` tinyint(1) DEFAULT '1',
  `win_points` decimal(10,2) DEFAULT '100.00',
  `draw_points` decimal(10,2) DEFAULT '40.00',
  `loss_points` decimal(10,2) DEFAULT '10.00',
  `opp_top10` decimal(5,2) DEFAULT '2.00',
  `opp_top25` decimal(5,2) DEFAULT '1.50',
  `opp_top50` decimal(5,2) DEFAULT '1.20',
  `opp_bot50` decimal(5,2) DEFAULT '1.00',
  `opp_bot25` decimal(5,2) DEFAULT '0.80',
  `comp_regional_div2` decimal(5,2) DEFAULT '0.80',
  `comp_regional_div1` decimal(5,2) DEFAULT '1.00',
  `comp_challenger` decimal(5,2) DEFAULT '1.20',
  `comp_elite` decimal(5,2) DEFAULT '1.50',
  `comp_supreme` decimal(5,2) DEFAULT '2.00',
  `comp_tournament` decimal(5,2) DEFAULT '1.00',
  `stage_group` decimal(5,2) DEFAULT '1.00',
  `stage_playoff` decimal(5,2) DEFAULT '1.10',
  `stage_r16` decimal(5,2) DEFAULT '1.20',
  `stage_qf` decimal(5,2) DEFAULT '1.40',
  `stage_sf` decimal(5,2) DEFAULT '1.60',
  `stage_final` decimal(5,2) DEFAULT '2.00',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `rating_history`
--

CREATE TABLE `rating_history` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opponent_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opponent_club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `match_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competition_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'tournament',
  `competition_slug` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `division` int DEFAULT NULL,
  `phase` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result` varchar(1) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_score` int DEFAULT '0',
  `away_score` int DEFAULT '0',
  `points_before` decimal(10,2) DEFAULT '0.00',
  `points_after` decimal(10,2) DEFAULT '0.00',
  `points_change` decimal(10,2) DEFAULT '0.00',
  `opponent_rank` int DEFAULT '0',
  `opp_strength_multiplier` decimal(5,2) DEFAULT '1.00',
  `competition_multiplier` decimal(5,2) DEFAULT '1.00',
  `stage_multiplier` decimal(5,2) DEFAULT '1.00',
  `voided` tinyint(1) DEFAULT '0',
  `void_reason` text COLLATE utf8mb4_unicode_ci,
  `played_at` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `recruitment_interests`
--

CREATE TABLE `recruitment_interests` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recruitment_post_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `recruitment_posts`
--

CREATE TABLE `recruitment_posts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `post_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `positions_needed` json DEFAULT NULL,
  `preferred_positions` json DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `availability_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discord_handle` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mic_required` tinyint(1) DEFAULT '0',
  `verified_only` tinyint(1) DEFAULT '0',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `expires_at` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `recruitment_posts`
--

INSERT INTO `recruitment_posts` (`id`, `author_user_id`, `author_player_id`, `author_club_id`, `post_type`, `title`, `body`, `positions_needed`, `preferred_positions`, `platform`, `region`, `availability_text`, `discord_handle`, `mic_required`, `verified_only`, `status`, `expires_at`, `created_date`, `updated_date`) VALUES
('c011e14f-1393-4b48-904b-72a7faab5805', '2138f545-75e8-43e4-ad0a-8a1593767c1d', NULL, '9ae52991-60be-4309-a28e-f7c16f23b0e5', 'club_recruiting', 'Zaire is recruiting', 'He we high rate club but we are still looking for improve our team.\n\nThey are now 3 open spots in our club', '[\"CF\", \"ST\", \"LM\"]', '[]', 'PlayStation', 'Europe', 'Tonight at 21', NULL, 0, 0, 'open', '2026-07-21 19:50:00', '2026-05-15 19:26:33', '2026-05-15 19:26:33');

-- --------------------------------------------------------

--
-- Structure de la table `regional_leagues`
--

CREATE TABLE `regional_leagues` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region_slug` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `division` int DEFAULT '1',
  `country_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_number` int DEFAULT '1',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `archived_at` datetime DEFAULT NULL,
  `next_season_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_clubs` int DEFAULT '16',
  `num_clubs` int DEFAULT '0',
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `promoted_slots` int DEFAULT '2',
  `target_competition_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_competition_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_competition_tier` int DEFAULT NULL,
  `target_season_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registered_club_ids` json DEFAULT NULL,
  `winner_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_club_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organizer_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trophy_item_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_url` text COLLATE utf8mb4_unicode_ci,
  `linked_league_slug` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_notes` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `trophy_image_url` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `regional_league_fixtures`
--

CREATE TABLE `regional_league_fixtures` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `league_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `league_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region_slug` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `division` int DEFAULT '1',
  `season_number` int DEFAULT '1',
  `matchday` int NOT NULL,
  `home_club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `home_club_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `home_club_tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `away_club_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `away_club_tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `window_start` datetime DEFAULT NULL,
  `window_end` datetime DEFAULT NULL,
  `window_days` int DEFAULT '4',
  `scheduling_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `home_proposed_date` datetime DEFAULT NULL,
  `away_proposed_date` datetime DEFAULT NULL,
  `confirmed_date` datetime DEFAULT NULL,
  `last_proposed_by` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proposal_count` int DEFAULT '0',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'unscheduled',
  `home_score` int DEFAULT '0',
  `away_score` int DEFAULT '0',
  `home_submitted_score` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `away_submitted_score` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_club_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stats_processed` tinyint(1) DEFAULT '0',
  `admin_notes` text COLLATE utf8mb4_unicode_ci,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `match_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `regional_league_standings`
--

CREATE TABLE `regional_league_standings` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `league_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `league_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region_slug` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `division` int DEFAULT '1',
  `season_number` int DEFAULT '1',
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `club_tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` int DEFAULT '1',
  `played` int DEFAULT '0',
  `wins` int DEFAULT '0',
  `draws` int DEFAULT '0',
  `losses` int DEFAULT '0',
  `goals_for` int DEFAULT '0',
  `goals_against` int DEFAULT '0',
  `goal_difference` int DEFAULT '0',
  `points` int DEFAULT '0',
  `form` json DEFAULT NULL,
  `is_stage_qualified` tinyint(1) DEFAULT '0',
  `stage_competition_slug` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_promoted` tinyint(1) DEFAULT '0',
  `is_relegated` tinyint(1) DEFAULT '0',
  `final_position` int DEFAULT NULL,
  `promotion_target_league_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relegation_target_league_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `reward_configs`
--

CREATE TABLE `reward_configs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` int NOT NULL,
  `position_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `badge_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'participant',
  `stc_amount` decimal(12,2) DEFAULT '0.00',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `reward_configs`
--

INSERT INTO `reward_configs` (`id`, `source_id`, `source_type`, `source_name`, `position`, `position_label`, `badge_type`, `stc_amount`, `created_date`, `updated_date`) VALUES
('0313a343-a20f-4146-b303-7ae7ccf24635', 'd70b1337-849f-456c-a5fa-c133d8496fc9', 'competition', 'STAGE Supreme League', 5, '5th Place', 'top_4', 1500000.00, '2026-05-13 21:52:52', '2026-05-13 21:52:52'),
('30bc011f-0f6b-4e40-9d25-93d58d7a5304', 'd70b1337-849f-456c-a5fa-c133d8496fc9', 'competition', 'STAGE Supreme League', 4, '4th Place', 'semi_finalist', 2000000.00, '2026-05-13 21:52:52', '2026-05-13 21:52:52'),
('9d1c0e1d-b42c-474d-8b56-c64f4b263b26', 'd70b1337-849f-456c-a5fa-c133d8496fc9', 'competition', 'STAGE Supreme League', 6, '6th Place', 'top_4', 1000000.00, '2026-05-13 21:52:52', '2026-05-13 21:52:52'),
('e9aa2f42-9559-49e2-b4f6-f976e36a9184', 'd70b1337-849f-456c-a5fa-c133d8496fc9', 'competition', 'STAGE Supreme League', 3, '3rd Place', 'semi_finalist', 700000.00, '2026-05-13 21:52:52', '2026-05-13 21:52:52'),
('ebd9e2b0-44c0-4c38-ba15-1aa660bfbb8a', 'd70b1337-849f-456c-a5fa-c133d8496fc9', 'competition', 'STAGE Supreme League', 1, 'Winner', 'winner', 16000000.00, '2026-05-13 21:52:52', '2026-05-13 21:52:52'),
('f9e2c4d5-ddd8-4e1e-93bb-6be2e8489640', 'd70b1337-849f-456c-a5fa-c133d8496fc9', 'competition', 'STAGE Supreme League', 2, 'Runner-Up', 'finalist', 1000000.00, '2026-05-13 21:52:52', '2026-05-13 21:52:52');

-- --------------------------------------------------------

--
-- Structure de la table `roles`
--

CREATE TABLE `roles` (
  `id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `roles`
--

INSERT INTO `roles` (`id`, `name`, `description`, `created_date`, `updated_date`) VALUES
(0, 'admin', 'Administrator role', '2026-05-06 17:35:09', '2026-05-06 19:37:24'),
(1, 'player_club', 'Player/Club role', '2026-05-06 17:35:09', '2026-05-06 17:35:09');

-- --------------------------------------------------------

--
-- Structure de la table `sbcs`
--

CREATE TABLE `sbcs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `requirements` json DEFAULT NULL,
  `reward` json DEFAULT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_completions` int DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `sbc_submissions`
--

CREATE TABLE `sbc_submissions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sbc_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_gamertag` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sacrificed_player_ids` json DEFAULT NULL,
  `reward_payload` json DEFAULT NULL,
  `stc_credited` decimal(12,2) DEFAULT '0.00',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  `submitted_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `season_registrations`
--

CREATE TABLE `season_registrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `club_logo_url` text COLLATE utf8mb4_unicode_ci,
  `owner_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `region_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `region_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `preferred_division` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note_from_club` text COLLATE utf8mb4_unicode_ci,
  `season_label` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `assigned_league_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_league_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_division` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_notes` text COLLATE utf8mb4_unicode_ci,
  `reviewed_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `applied_at` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `shirt_sales`
--

CREATE TABLE `shirt_sales` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_gamertag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shirt_number` int DEFAULT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `buyer_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_stc` decimal(12,2) DEFAULT '0.00',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `match_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `shirt_sales_config`
--

CREATE TABLE `shirt_sales_config` (
  `id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'default',
  `weights` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `shirt_sales_config`
--

INSERT INTO `shirt_sales_config` (`id`, `name`, `weights`, `is_active`, `created_date`, `updated_date`) VALUES
(1, 'default', '{\"price_base\": 3000, \"goal_demand\": 4, \"motm_demand\": 6, \"assist_demand\": 2, \"max_per_match\": 12, \"base_per_mv_1m\": 0.5, \"contract_boost\": 0.1, \"form_influence\": 0.12, \"price_per_goal\": 300, \"price_per_assist\": 200, \"clean_sheet_demand\": 2, \"price_per_ovr_above_70\": 800, \"price_per_rating_point\": 1500, \"rating_demand_per_point\": 1.5}', 1, '2026-05-11 13:56:35', '2026-05-11 13:56:35');

-- --------------------------------------------------------

--
-- Structure de la table `stadium_config`
--

CREATE TABLE `stadium_config` (
  `id` int NOT NULL,
  `level` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `capacity` int DEFAULT '5000',
  `ticket_price_stc` decimal(8,2) DEFAULT '15.00',
  `upgrade_cost_stc` bigint DEFAULT '0',
  `description` text COLLATE utf8mb4_unicode_ci,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `stadium_config`
--

INSERT INTO `stadium_config` (`id`, `level`, `name`, `capacity`, `ticket_price_stc`, `upgrade_cost_stc`, `description`, `updated_date`) VALUES
(1, 0, 'Local Ground', 5000, 15.00, 0, 'A humble but passionate home ground. Every great club starts somewhere.', '2026-05-11 13:56:36'),
(2, 1, 'Pro Stadium', 20000, 50.00, 50000000, 'Professional-grade facilities. The home ground for serious clubs.', '2026-05-11 13:56:36'),
(3, 2, 'Elite Ground', 45000, 130.00, 120000000, 'State-of-the-art stadium. Champions League ready.', '2026-05-11 13:56:36'),
(4, 3, 'Iconic Arena', 80000, 180.00, 250000000, 'A legendary venue. The world\'s eyes are on you.', '2026-05-11 13:56:36');

-- --------------------------------------------------------

--
-- Structure de la table `stc_transactions`
--

CREATE TABLE `stc_transactions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `club_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `reference_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `balance_after` decimal(12,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `stc_transactions`
--

INSERT INTO `stc_transactions` (`id`, `club_id`, `amount`, `type`, `description`, `reference_id`, `created_date`, `player_id`, `player_email`, `category`, `balance_after`) VALUES
('02a83cde-2afd-4c61-ac8d-451f2b2f7ba8', '9ae52991-60be-4309-a28e-f7c16f23b0e5', -1500.00, 'tournament_entry', 'Tournament entry fee: STAGE Supreme League', '86d5672d-4bcb-4277-8d70-4f30a14c4908', '2026-05-11 23:16:49', NULL, NULL, 'tournament_entry', 29998500.00),
('26e8625c-b0c2-4164-bb53-9763b42df36b', '2df50dab-b2b1-4106-9502-cd2437640ab6', -1000000.00, 'tournament_entry', 'Tournament entry fee: STAGE Weekend League', '68d99492-5fae-4308-a3c3-b71cf0b0d05a', '2026-05-14 18:00:40', NULL, NULL, 'tournament_entry', 28998500.00),
('7bb2be61-6c33-4f18-9076-9db52b20d723', '2df50dab-b2b1-4106-9502-cd2437640ab6', -1500.00, 'tournament_entry', 'Tournament entry fee: STAGE Supreme League', '86d5672d-4bcb-4277-8d70-4f30a14c4908', '2026-05-11 23:14:01', NULL, NULL, 'tournament_entry', 29998500.00),
('9cc6cead-5995-464d-813d-a6b3db7733de', '2df50dab-b2b1-4106-9502-cd2437640ab6', 1500.00, 'tournament_entry', 'Tournament withdrawal refund: STAGE Supreme League', '86d5672d-4bcb-4277-8d70-4f30a14c4908', '2026-05-14 17:42:47', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `tournaments`
--

CREATE TABLE `tournaments` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `current_round` int DEFAULT '0',
  `num_groups` int DEFAULT '4',
  `winner_club_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `winner_club_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trophy_url` text COLLATE utf8mb4_unicode_ci,
  `registered_players` json DEFAULT NULL,
  `registered_clubs` json DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `participant_type` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'club',
  `platform` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_teams` int DEFAULT NULL,
  `entry_credits` int DEFAULT '50',
  `entry_fee_stc` bigint DEFAULT '0',
  `prize_description` text COLLATE utf8mb4_unicode_ci,
  `prize_pool_stc` bigint DEFAULT '0',
  `prize_winner_stc` bigint DEFAULT '0',
  `prize_runner_up_stc` bigint DEFAULT '0',
  `prize_semi_final_stc` bigint DEFAULT '0',
  `prize_participation_stc` bigint DEFAULT '0',
  `custom_rules` text COLLATE utf8mb4_unicode_ci,
  `rules_file_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `organizer_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creator_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creator_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creator_gamertag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `win_credits` int DEFAULT '150',
  `win_credits_awarded` tinyint(1) DEFAULT '0',
  `total_rounds` int DEFAULT NULL,
  `swiss_rounds` int DEFAULT '5',
  `season` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ucl_phase` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'league',
  `banner_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_position` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '50% 50%',
  `trophy_item_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `tournaments`
--

INSERT INTO `tournaments` (`id`, `name`, `status`, `current_round`, `num_groups`, `winner_club_id`, `winner_club_name`, `trophy_url`, `registered_players`, `registered_clubs`, `created_date`, `updated_date`, `description`, `type`, `participant_type`, `platform`, `region`, `max_teams`, `entry_credits`, `entry_fee_stc`, `prize_description`, `prize_pool_stc`, `prize_winner_stc`, `prize_runner_up_stc`, `prize_semi_final_stc`, `prize_participation_stc`, `custom_rules`, `rules_file_url`, `country_code`, `start_date`, `end_date`, `organizer_email`, `creator_email`, `creator_id`, `creator_gamertag`, `win_credits`, `win_credits_awarded`, `total_rounds`, `swiss_rounds`, `season`, `ucl_phase`, `banner_url`, `banner_color`, `banner_position`, `trophy_item_id`) VALUES
('68d99492-5fae-4308-a3c3-b71cf0b0d05a', 'STAGE Weekend League', 'registration', 1, NULL, NULL, NULL, 'https://stageleagues.com/uploads/2e20ad76-ead8-4218-bcd6-0c9669d22e7d.png', '[]', '[\"2df50dab-b2b1-4106-9502-cd2437640ab6\"]', '2026-05-14 17:52:35', '2026-05-14 18:00:40', '', 'league', 'club', 'PlayStation', 'Global', 4, 0, 1000000, '', NULL, 0, 0, 0, 0, '', '', '', '2026-05-14 19:00:00', NULL, 'krikke', 'krikke', NULL, NULL, 200, NULL, NULL, NULL, NULL, NULL, '', '#1e2a3a', NULL, 'f499d361-de6a-40ec-bcb0-3de785aaf527'),
('86d5672d-4bcb-4277-8d70-4f30a14c4908', 'STAGE Supreme League', 'cancelled', 1, NULL, NULL, NULL, 'https://stageleagues.com/uploads/87f7f77f-c41a-45ae-9d3f-9446b5e59a39.PNG', '[]', '[\"9ae52991-60be-4309-a28e-f7c16f23b0e5\"]', '2026-05-11 22:19:50', '2026-05-14 17:44:12', '', 'swiss_ucl', 'club', 'PlayStation', 'Global', 36, 0, 1500, '', NULL, 100000, 0, 0, 0, '', '', '', '2026-05-13 22:00:00', NULL, 'krikke', 'krikke', NULL, NULL, 200, NULL, NULL, NULL, NULL, NULL, 'https://stageleagues.com/uploads/9ce52838-2f19-4c83-bbf5-3f12706f2b3a.PNG', '', NULL, 'c2198d11-53fe-4e7c-ac6b-d18dab1f633f');

-- --------------------------------------------------------

--
-- Structure de la table `transfer_windows`
--

CREATE TABLE `transfer_windows` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `transfers_executed` int DEFAULT '0',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `transfer_windows`
--

INSERT INTO `transfer_windows` (`id`, `label`, `status`, `start_date`, `end_date`, `notes`, `transfers_executed`, `created_date`, `updated_date`) VALUES
('1cafbcbc-4535-44fe-b927-0aa0dfe44093', 'Summer 2026', 'open', '2026-05-15 18:26:53', '2026-05-30 20:26:00', '', 0, '2026-05-15 18:26:53', '2026-05-15 18:26:53');

-- --------------------------------------------------------

--
-- Structure de la table `trophy_items`
--

CREATE TABLE `trophy_items` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `competition_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tournament_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tournament_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_official` tinyint(1) DEFAULT '0',
  `admin_only` tinyint(1) DEFAULT '0',
  `description` text COLLATE utf8mb4_unicode_ci,
  `image_url` text COLLATE utf8mb4_unicode_ci,
  `rarity` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'common',
  `price` int DEFAULT '0',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `linked_source_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linked_source_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linked_source_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `trophy_items`
--

INSERT INTO `trophy_items` (`id`, `name`, `sort_order`, `competition_name`, `tournament_id`, `tournament_type`, `is_official`, `admin_only`, `description`, `image_url`, `rarity`, `price`, `created_date`, `updated_date`, `linked_source_type`, `linked_source_id`, `linked_source_name`) VALUES
('0dc84db3-922f-4142-819c-fb6827efc6dd', 'STAGE Elite League', 5, NULL, NULL, NULL, 1, 1, NULL, 'https://stageleagues.com/uploads/0c696b9e-d38b-4055-b8f1-382b8c104f2c.PNG', 'common', 0, '2026-05-11 21:09:33', '2026-05-13 20:49:45', 'competition', 'c8eafddc-e09d-4b3e-b300-00b9b1d5eeb5', 'STAGE Elite League'),
('4f71f73f-8f59-490d-b4d0-c92d8d68ec28', 'STAGE La Liga de España', 3, NULL, NULL, NULL, 1, 1, NULL, 'https://stageleagues.com/uploads/bd20cead-24f9-44e4-aad9-73fe9dd7d5b6.PNG', 'common', 0, '2026-05-11 21:07:41', '2026-05-13 20:48:48', 'regional_league', '4d7acc11-dc87-4eb3-b835-057cf00b5d40', 'STAGE La Liga de España'),
('ae426302-0d22-420d-afc3-ac44215209aa', 'STAGE Benelux Pro League', 4, NULL, NULL, NULL, 1, 1, NULL, 'https://stageleagues.com/uploads/9cfd1a41-2cc5-4e2e-9a6e-fecf550e952f.PNG', 'common', 0, '2026-05-11 21:05:15', '2026-05-13 20:49:14', 'regional_league', '01bf3f43-cbc4-4178-9608-c54955334b3e', 'STAGE Benelux Pro League'),
('b5c99a0d-78f2-4a59-8893-62e3984f5ba7', 'STAGE Champions Cup', 8, NULL, NULL, NULL, 0, 0, NULL, 'https://stageleagues.com/uploads/97c5ffb4-8354-4ac4-95c7-0f093c83d5f7.png', 'common', 0, '2026-05-15 15:14:34', '2026-05-15 15:14:34', NULL, NULL, NULL),
('b78487a1-2295-46bd-90fb-c7f91b56da8e', 'STAGE Deutsche Liga', 5, NULL, NULL, NULL, 1, 1, NULL, 'https://stageleagues.com/uploads/ec66d78c-df39-47d7-9f3b-5bb173e75364.PNG', 'common', 0, '2026-05-11 21:06:11', '2026-05-13 20:49:56', 'regional_league', '670a2e85-2da4-41ab-af4f-355157b7bfa6', 'STAGE Deutsche Liga'),
('c2198d11-53fe-4e7c-ac6b-d18dab1f633f', 'STAGE Supreme League', 6, NULL, NULL, NULL, 1, 1, NULL, 'https://stageleagues.com/uploads/87f7f77f-c41a-45ae-9d3f-9446b5e59a39.PNG', 'common', 0, '2026-05-11 21:11:29', '2026-05-13 20:51:48', 'competition', 'd70b1337-849f-456c-a5fa-c133d8496fc9', 'STAGE Supreme League'),
('ccfa3bbb-3226-4459-ba08-f0c68e15323a', 'STAGE Challenger League', 4, NULL, NULL, NULL, 1, 1, NULL, 'https://stageleagues.com/uploads/8bd146c7-dbe3-4797-b1ac-7d03b72a334b.PNG', 'common', 0, '2026-05-11 21:08:33', '2026-05-13 20:49:34', 'competition', '12a13023-1af8-48a6-af25-89565af45709', 'STAGE Challenger League'),
('d709fb2d-3a8e-4e17-a483-b2ed0aa23e8d', 'STAGE Premier Division', 3, NULL, NULL, NULL, 1, 1, NULL, 'https://stageleagues.com/uploads/1f16a9c6-a74c-4135-a09f-ae66fb8b205f.PNG', 'common', 0, '2026-05-11 15:25:18', '2026-05-13 20:49:05', 'regional_league', 'c2d6e60f-89e0-4813-81a1-967551d8d69f', 'STAGE Premier Division'),
('f499d361-de6a-40ec-bcb0-3de785aaf527', 'STAGE Champions Cup', 7, NULL, NULL, NULL, 1, 0, NULL, 'https://stageleagues.com/uploads/2e20ad76-ead8-4218-bcd6-0c9669d22e7d.png', 'common', 0, '2026-05-14 17:52:35', '2026-05-15 15:13:53', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `trophy_placements`
--

CREATE TABLE `trophy_placements` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trophy_item_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` int DEFAULT '0',
  `trophy_image_url` text COLLATE utf8mb4_unicode_ci,
  `trophy_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `x_percent` decimal(6,2) DEFAULT '50.00',
  `y_percent` decimal(6,2) DEFAULT '50.00',
  `scale` decimal(5,3) DEFAULT '1.000',
  `won_tournament_ids` json DEFAULT NULL,
  `win_count` int DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `player_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `role_id` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `email`, `password_hash`, `player_id`, `owner_id`, `created_date`, `updated_date`, `role_id`) VALUES
('2138f545-75e8-43e4-ad0a-8a1593767c1d', 'berton.lutina@hotmail.com', '$2a$10$.qUVtfkJZ0rvG.1k6HWzduMyrzMraazxzUHiyU6RTp6QOqEaVlC6e', 'd759e668-82a0-4ba8-bb55-25decc217e97', '9ae52991-60be-4309-a28e-f7c16f23b0e5', '2026-05-05 18:32:32', '2026-05-15 22:29:34', 1),
('2c799afb-4a0c-11f1-8e8d-00163e198961', 'krikke', '$2a$12$SP1mEyPPb62OHvaOFGsjnuV1h1IWRL7992KMCNZsjLvaYzdEmUpmy', NULL, NULL, '2026-05-07 11:59:17', '2026-05-07 11:59:17', 0),
('6c57466b-fb5d-4c32-b9f4-e3739aed2bef', 'berton.lutina@gmail.com', '$2a$10$CUyxR1aUZMoflNTH79xiVuVwedbEJi84iXcwGRkKVLqa6rS/asTyy', '97d665c1-a632-4654-b8e0-2c71c75fd6a3', NULL, '2026-05-07 11:42:28', '2026-05-07 14:39:51', 1),
('7aca58a2-c6a8-40a3-870f-a269dff6372d', 'chris.dm.kalonji@hotmail.com', '$2a$10$nZeGBf1AjaNL9sx2jffUDuljTP9ufrnCT1W1EhZ/OAfGtycv/.G3y', '433cb010-23d8-41c4-8cdf-6fcab1004602', '81ce69e2-5b46-4c68-ba36-af03b70b9709', '2026-05-08 08:20:02', '2026-05-08 08:26:18', 1),
('9d8ebd1a-3575-4305-b1e4-a91f2ba94c79', 'creaafde@hotmail.com', '$2a$10$6VhPplaa35900k4fxicGQul3NID7oC.WYO6M7L2znGXHcJGT3tp2.', NULL, NULL, '2026-05-06 18:30:54', '2026-05-06 18:31:55', 0),
('c6027070-b11c-4c92-8e34-be84a804f9d8', 'lutinabeats@gmail.com', '$2a$10$7g95D0Dmu2jIEXQb/n4nuuFcqzl54Y955qgq9cojJoZN6NrIZcTHi', '153014cd-f6b7-4a59-8d38-5b52c06e5863', NULL, '2026-05-06 05:46:51', '2026-05-08 19:25:38', 1);

-- --------------------------------------------------------

--
-- Structure de la table `user_purchases`
--

CREATE TABLE `user_purchases` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `buyer_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_paid` bigint DEFAULT '0',
  `purchase_date` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `admin_audit_log`
--
ALTER TABLE `admin_audit_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_aal_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_aal_admin` (`admin_user_id`),
  ADD KEY `idx_aal_created` (`created_date`);

--
-- Index pour la table `archetypes`
--
ALTER TABLE `archetypes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_arch_position` (`position`),
  ADD KEY `idx_arch_active` (`is_active`);

--
-- Index pour la table `auth_tokens`
--
ALTER TABLE `auth_tokens`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `challenges`
--
ALTER TABLE `challenges`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chat_match` (`match_id`);

--
-- Index pour la table `chemistry_links`
--
ALTER TABLE `chemistry_links`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_chem_pair_type` (`player_a_id`,`player_b_id`,`link_type`),
  ADD KEY `idx_chem_player_a` (`player_a_id`),
  ADD KEY `idx_chem_player_b` (`player_b_id`),
  ADD KEY `idx_chem_type` (`link_type`);

--
-- Index pour la table `clubs`
--
ALTER TABLE `clubs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_clubs_owner` (`owner_email`),
  ADD KEY `idx_clubs_user` (`user_id`);

--
-- Index pour la table `club_achievements`
--
ALTER TABLE `club_achievements`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `club_applicants`
--
ALTER TABLE `club_applicants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ca_source` (`source_type`,`source_id`),
  ADD KEY `idx_ca_club_status` (`club_id`,`status`),
  ADD KEY `idx_ca_player` (`player_id`);

--
-- Index pour la table `club_fixture_availability`
--
ALTER TABLE `club_fixture_availability`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_cfa_player_fixture` (`club_id`,`fixture_id`,`player_id`),
  ADD KEY `idx_cfa_fixture` (`club_id`,`fixture_id`),
  ADD KEY `idx_cfa_player` (`player_id`);

--
-- Index pour la table `club_fixture_lineups`
--
ALTER TABLE `club_fixture_lineups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_cfl_fixture` (`club_id`,`fixture_id`),
  ADD KEY `idx_cfl_fixture` (`club_id`,`fixture_id`);

--
-- Index pour la table `club_operation_audit_logs`
--
ALTER TABLE `club_operation_audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_coal_club_created` (`club_id`,`created_date`);

--
-- Index pour la table `club_staff_roles`
--
ALTER TABLE `club_staff_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_csr_role` (`club_id`,`player_id`,`role`),
  ADD KEY `idx_csr_club` (`club_id`),
  ADD KEY `idx_csr_player` (`player_id`);

--
-- Index pour la table `comments`
--
ALTER TABLE `comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_comments_post` (`post_id`);

--
-- Index pour la table `competitions`
--
ALTER TABLE `competitions`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `competition_fixtures`
--
ALTER TABLE `competition_fixtures`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `competition_seasons`
--
ALTER TABLE `competition_seasons`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `competition_standings`
--
ALTER TABLE `competition_standings`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `direct_messages`
--
ALTER TABLE `direct_messages`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `dressing_rooms`
--
ALTER TABLE `dressing_rooms`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_dressing_rooms_match_id` (`match_id`),
  ADD KEY `fk_dressing_rooms_club_id` (`club_id`);

--
-- Index pour la table `faq_items`
--
ALTER TABLE `faq_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_faq_sort` (`sort_order`),
  ADD KEY `idx_faq_active` (`is_active`);

--
-- Index pour la table `fixture_admin_actions`
--
ALTER TABLE `fixture_admin_actions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_fixture` (`fixture_id`),
  ADD KEY `idx_action` (`action_type`),
  ADD KEY `idx_performed_by` (`performed_by`),
  ADD KEY `idx_created` (`created_date`);

--
-- Index pour la table `follows`
--
ALTER TABLE `follows`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_follow` (`follower_email`,`target_id`,`target_type`),
  ADD KEY `idx_follows_email` (`follower_email`),
  ADD KEY `fk_follows_follower_player_id` (`follower_player_id`);

--
-- Index pour la table `home_page_contents`
--
ALTER TABLE `home_page_contents`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `inbox_messages`
--
ALTER TABLE `inbox_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inbox_rcpt` (`recipient_email`);

--
-- Index pour la table `join_requests`
--
ALTER TABLE `join_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_join_requests_player_id` (`player_id`);

--
-- Index pour la table `landing_config`
--
ALTER TABLE `landing_config`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `landing_page_contents`
--
ALTER TABLE `landing_page_contents`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `league_entities`
--
ALTER TABLE `league_entities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_le_type` (`entity_type`),
  ADD KEY `idx_le_type_status` (`entity_type`,`status`),
  ADD KEY `idx_le_slug` (`entity_type`,`slug`),
  ADD KEY `idx_le_league` (`entity_type`,`league_id`),
  ADD KEY `idx_le_season` (`entity_type`,`season_id`),
  ADD KEY `idx_le_comp` (`entity_type`,`competition_id`);

--
-- Index pour la table `lifestyle_items`
--
ALTER TABLE `lifestyle_items`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `lifestyle_purchases`
--
ALTER TABLE `lifestyle_purchases`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_lifestyle_purchases_player_id` (`player_id`),
  ADD KEY `fk_lifestyle_purchases_item_id` (`item_id`);

--
-- Index pour la table `live_matches`
--
ALTER TABLE `live_matches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_live_matches_match_id` (`match_id`);

--
-- Index pour la table `live_match_events`
--
ALTER TABLE `live_match_events`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `market_value_config`
--
ALTER TABLE `market_value_config`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `matches`
--
ALTER TABLE `matches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_matches_home` (`home_club_id`),
  ADD KEY `idx_matches_away` (`away_club_id`),
  ADD KEY `idx_matches_tournament` (`tournament_id`),
  ADD KEY `idx_matches_source_fx` (`source_fixture_id`),
  ADD KEY `fk_matches_home_player_id` (`home_player_id`),
  ADD KEY `fk_matches_away_player_id` (`away_player_id`);

--
-- Index pour la table `match_player_stats`
--
ALTER TABLE `match_player_stats`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_stats_match` (`match_id`);

--
-- Index pour la table `news_items`
--
ALTER TABLE `news_items`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_rcpt` (`recipient_email`);

--
-- Index pour la table `objective_definitions`
--
ALTER TABLE `objective_definitions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_obj_scope_active` (`scope`,`is_active`),
  ADD KEY `idx_obj_metric` (`metric`),
  ADD KEY `idx_obj_code` (`code`);

--
-- Index pour la table `objective_progress`
--
ALTER TABLE `objective_progress`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_op_player_obj` (`player_id`,`objective_id`),
  ADD KEY `idx_op_player` (`player_id`),
  ADD KEY `idx_op_objective` (`objective_id`),
  ADD KEY `idx_op_unclaimed` (`player_id`,`completed_at`,`claimed_at`);

--
-- Index pour la table `players`
--
ALTER TABLE `players`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_players_club` (`club_id`),
  ADD KEY `idx_players_email` (`email`),
  ADD KEY `idx_players_oauth` (`oauth_provider`,`oauth_id`),
  ADD KEY `idx_players_user` (`user_id`);

--
-- Index pour la table `player_achievements`
--
ALTER TABLE `player_achievements`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `player_contracts`
--
ALTER TABLE `player_contracts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_contracts_team` (`team_id`),
  ADD KEY `idx_contracts_user` (`user_id`);

--
-- Index pour la table `player_contract_history`
--
ALTER TABLE `player_contract_history`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `player_identity_claims`
--
ALTER TABLE `player_identity_claims`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pic_player` (`player_id`),
  ADD KEY `idx_pic_user` (`user_id`),
  ADD KEY `idx_pic_status` (`status`),
  ADD KEY `idx_pic_created` (`created_date`);

--
-- Index pour la table `player_stc_transactions`
--
ALTER TABLE `player_stc_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pst_player` (`player_id`),
  ADD KEY `idx_pst_created` (`created_date`);

--
-- Index pour la table `posts`
--
ALTER TABLE `posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_posts_club` (`club_id`),
  ADD KEY `idx_posts_author` (`author_email`);

--
-- Index pour la table `predictions`
--
ALTER TABLE `predictions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_predictions_live_match_id` (`live_match_id`);

--
-- Index pour la table `press_articles`
--
ALTER TABLE `press_articles`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `press_conferences`
--
ALTER TABLE `press_conferences`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `press_questions`
--
ALTER TABLE `press_questions`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `qualification_entries`
--
ALTER TABLE `qualification_entries`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `ranking_configs`
--
ALTER TABLE `ranking_configs`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `rating_history`
--
ALTER TABLE `rating_history`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `recruitment_interests`
--
ALTER TABLE `recruitment_interests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ri_post` (`recruitment_post_id`),
  ADD KEY `idx_ri_sender_user` (`sender_user_id`),
  ADD KEY `idx_ri_recipient_user` (`recipient_user_id`),
  ADD KEY `idx_ri_status` (`status`);

--
-- Index pour la table `recruitment_posts`
--
ALTER TABLE `recruitment_posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_rp_type_status` (`post_type`,`status`),
  ADD KEY `idx_rp_player` (`author_player_id`),
  ADD KEY `idx_rp_club` (`author_club_id`),
  ADD KEY `idx_rp_platform_region` (`platform`,`region`),
  ADD KEY `idx_rp_created` (`created_date`);

--
-- Index pour la table `regional_leagues`
--
ALTER TABLE `regional_leagues`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `regional_league_fixtures`
--
ALTER TABLE `regional_league_fixtures`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `regional_league_standings`
--
ALTER TABLE `regional_league_standings`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `reward_configs`
--
ALTER TABLE `reward_configs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_reward_source` (`source_type`,`source_id`,`position`);

--
-- Index pour la table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Index pour la table `sbcs`
--
ALTER TABLE `sbcs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sbc_active` (`is_active`,`expires_at`),
  ADD KEY `idx_sbc_category` (`category`);

--
-- Index pour la table `sbc_submissions`
--
ALTER TABLE `sbc_submissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sbcsub_sbc` (`sbc_id`),
  ADD KEY `idx_sbcsub_player` (`player_id`),
  ADD KEY `idx_sbcsub_status` (`status`,`created_date`);

--
-- Index pour la table `season_registrations`
--
ALTER TABLE `season_registrations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_season_reg_club` (`club_id`);

--
-- Index pour la table `shirt_sales`
--
ALTER TABLE `shirt_sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shirt_sales_club_id` (`club_id`);

--
-- Index pour la table `shirt_sales_config`
--
ALTER TABLE `shirt_sales_config`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `stadium_config`
--
ALTER TABLE `stadium_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `level` (`level`);

--
-- Index pour la table `stc_transactions`
--
ALTER TABLE `stc_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_stc_club` (`club_id`);

--
-- Index pour la table `tournaments`
--
ALTER TABLE `tournaments`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `transfer_windows`
--
ALTER TABLE `transfer_windows`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `trophy_items`
--
ALTER TABLE `trophy_items`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `trophy_placements`
--
ALTER TABLE `trophy_placements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_trophy_placements_trophy_item_id` (`trophy_item_id`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_users_role_id` (`role_id`);

--
-- Index pour la table `user_purchases`
--
ALTER TABLE `user_purchases`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `shirt_sales_config`
--
ALTER TABLE `shirt_sales_config`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `stadium_config`
--
ALTER TABLE `stadium_config`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `clubs`
--
ALTER TABLE `clubs`
  ADD CONSTRAINT `fk_clubs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `comments`
--
ALTER TABLE `comments`
  ADD CONSTRAINT `fk_comments_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `dressing_rooms`
--
ALTER TABLE `dressing_rooms`
  ADD CONSTRAINT `fk_dressing_rooms_club_id` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_dressing_rooms_match_id` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `follows`
--
ALTER TABLE `follows`
  ADD CONSTRAINT `fk_follows_follower_player_id` FOREIGN KEY (`follower_player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `join_requests`
--
ALTER TABLE `join_requests`
  ADD CONSTRAINT `fk_join_requests_player_id` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `lifestyle_purchases`
--
ALTER TABLE `lifestyle_purchases`
  ADD CONSTRAINT `fk_lifestyle_purchases_item_id` FOREIGN KEY (`item_id`) REFERENCES `lifestyle_items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_lifestyle_purchases_player_id` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `live_matches`
--
ALTER TABLE `live_matches`
  ADD CONSTRAINT `fk_live_matches_match_id` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `matches`
--
ALTER TABLE `matches`
  ADD CONSTRAINT `fk_matches_away_club_id` FOREIGN KEY (`away_club_id`) REFERENCES `clubs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_matches_away_player_id` FOREIGN KEY (`away_player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_matches_home_club_id` FOREIGN KEY (`home_club_id`) REFERENCES `clubs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_matches_home_player_id` FOREIGN KEY (`home_player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_matches_tournament_id` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `match_player_stats`
--
ALTER TABLE `match_player_stats`
  ADD CONSTRAINT `fk_mps_match_id` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `players`
--
ALTER TABLE `players`
  ADD CONSTRAINT `fk_players_club_id` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_players_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `predictions`
--
ALTER TABLE `predictions`
  ADD CONSTRAINT `fk_predictions_live_match_id` FOREIGN KEY (`live_match_id`) REFERENCES `live_matches` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `shirt_sales`
--
ALTER TABLE `shirt_sales`
  ADD CONSTRAINT `fk_shirt_sales_club_id` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `trophy_placements`
--
ALTER TABLE `trophy_placements`
  ADD CONSTRAINT `fk_trophy_placements_trophy_item_id` FOREIGN KEY (`trophy_item_id`) REFERENCES `trophy_items` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
