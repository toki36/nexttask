package repository

import (
	"time"

	"nexttask/backend/internal/model"
	"nexttask/backend/internal/priority"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Open(databaseURL string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
}

func Migrate(db *gorm.DB) error {
	renamedWeight, err := renameLegacyWeightColumn(db)
	if err != nil {
		return err
	}
	if err := db.AutoMigrate(&model.User{}, &model.TaskGroup{}, &model.Task{}, &model.Schedule{}); err != nil {
		return err
	}
	if renamedWeight {
		if err := db.Exec(`
			UPDATE tasks
			SET importance = CASE
				WHEN importance <= 3 THEN 1
				WHEN importance <= 7 THEN 2
				ELSE 3
			END
		`).Error; err != nil {
			return err
		}
	}
	if db.Dialector.Name() == "postgres" {
		if err := db.Exec(`
			ALTER TABLE tasks ALTER COLUMN importance SET DEFAULT 2;
			ALTER TABLE schedules ALTER COLUMN group_id DROP NOT NULL;
			ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_group_id_fkey;
			ALTER TABLE schedules DROP CONSTRAINT IF EXISTS fk_task_groups_schedules;
			ALTER TABLE schedules
				ADD CONSTRAINT schedules_group_id_fkey
				FOREIGN KEY (group_id) REFERENCES task_groups(id) ON DELETE SET NULL;
		`).Error; err != nil {
			return err
		}
	}
	return recalculateTaskPriorities(db)
}

func renameLegacyWeightColumn(db *gorm.DB) (bool, error) {
	migrator := db.Migrator()
	if !migrator.HasTable("tasks") ||
		!migrator.HasColumn("tasks", "weight") ||
		migrator.HasColumn("tasks", "importance") {
		return false, nil
	}
	if err := migrator.RenameColumn("tasks", "weight", "importance"); err != nil {
		return false, err
	}
	return true, nil
}

func recalculateTaskPriorities(db *gorm.DB) error {
	var tasks []model.Task
	if err := db.Find(&tasks).Error; err != nil {
		return err
	}
	now := time.Now()
	for _, task := range tasks {
		score := priority.Score(task, now)
		if err := db.Model(&task).Update("priority_score", score).Error; err != nil {
			return err
		}
	}
	return nil
}
