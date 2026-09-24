CREATE TABLE `booking_email` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_email_email_unique` ON `booking_email` (`email`);--> statement-breakpoint
CREATE INDEX `booking_email_user_id_idx` ON `booking_email` (`user_id`);