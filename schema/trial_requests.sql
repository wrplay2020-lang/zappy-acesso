CREATE TABLE `trial_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`ip_hash` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
