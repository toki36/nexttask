package repository

import (
	"fmt"
	"testing"
	"time"

	"nexttask/backend/internal/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type legacyTask struct {
	ID               string  `gorm:"type:uuid;primaryKey"`
	UserID           string  `gorm:"type:uuid;not null;index"`
	GroupID          *string `gorm:"type:uuid"`
	Title            string  `gorm:"not null"`
	Description      string
	LocationName     *string
	StartTime        *time.Time `gorm:"index"`
	Deadline         time.Time  `gorm:"not null;index"`
	EstimatedMinutes int        `gorm:"not null"`
	Weight           int        `gorm:"not null;default:1"`
	PriorityScore    float64    `gorm:"not null;default:0"`
	Status           string     `gorm:"not null;default:open;index"`
	CompletedAt      *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (legacyTask) TableName() string {
	return "tasks"
}

func TestMigrateRenamesWeightAndMapsImportance(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:importance-migration?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get database: %v", err)
	}
	t.Cleanup(func() {
		if err := sqlDB.Close(); err != nil {
			t.Fatalf("close database: %v", err)
		}
	})

	if err := db.AutoMigrate(&model.User{}, &legacyTask{}); err != nil {
		t.Fatalf("migrate legacy schema: %v", err)
	}
	user := model.User{
		ID:           "00000000-0000-0000-0000-000000000001",
		Name:         "Migration Test",
		Email:        "migration@example.com",
		PasswordHash: "hash",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	for index, weight := range []int{1, 5, 10} {
		task := legacyTask{
			ID:               fmt.Sprintf("00000000-0000-0000-0000-00000000001%d", index),
			UserID:           user.ID,
			Title:            fmt.Sprintf("Task %d", index),
			Deadline:         time.Now().Add(24 * time.Hour),
			EstimatedMinutes: 30,
			Weight:           weight,
			Status:           string(model.TaskStatusOpen),
		}
		if err := db.Create(&task).Error; err != nil {
			t.Fatalf("insert legacy task: %v", err)
		}
	}

	if err := Migrate(db); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	if db.Migrator().HasColumn("tasks", "weight") {
		t.Fatal("legacy weight column still exists")
	}
	if !db.Migrator().HasColumn("tasks", "importance") {
		t.Fatal("importance column was not created")
	}

	var tasks []model.Task
	if err := db.Order("title").Find(&tasks).Error; err != nil {
		t.Fatalf("list migrated tasks: %v", err)
	}
	want := []int{1, 2, 3}
	if len(tasks) != len(want) {
		t.Fatalf("task count = %d, want %d", len(tasks), len(want))
	}
	for index, task := range tasks {
		if task.Importance != want[index] {
			t.Errorf("task %d importance = %d, want %d", index, task.Importance, want[index])
		}
	}
}
