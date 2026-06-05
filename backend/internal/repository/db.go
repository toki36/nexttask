package repository

import (
	"nexttask/backend/internal/model"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Open(databaseURL string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
}

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(&model.User{}, &model.TaskGroup{}, &model.Task{}, &model.Schedule{}); err != nil {
		return err
	}
	if db.Dialector.Name() == "postgres" {
		return db.Exec(`
			ALTER TABLE schedules ALTER COLUMN group_id DROP NOT NULL;
			ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_group_id_fkey;
			ALTER TABLE schedules DROP CONSTRAINT IF EXISTS fk_task_groups_schedules;
			ALTER TABLE schedules
				ADD CONSTRAINT schedules_group_id_fkey
				FOREIGN KEY (group_id) REFERENCES task_groups(id) ON DELETE SET NULL;
		`).Error
	}
	return nil
}
