CREATE TABLE `agencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`website_url` text NOT NULL,
	`scraper_config` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agencies_slug_unique` ON `agencies` (`slug`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agency_id` integer NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`price` integer NOT NULL,
	`bedrooms` integer,
	`living_surface_m2` real,
	`has_garden` integer NOT NULL,
	`description` text,
	`image_url` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`raw_updated_at` text,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
