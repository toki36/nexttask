package model

import "time"

type User struct {
	ID           string    `json:"id" gorm:"type:uuid;primaryKey"`
	Name         string    `json:"name" gorm:"not null"`
	Email        string    `json:"email" gorm:"not null;uniqueIndex"`
	PasswordHash string    `json:"-" gorm:"not null"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type TaskGroup struct {
	ID        string     `json:"id" gorm:"type:uuid;primaryKey"`
	UserID    string     `json:"user_id" gorm:"type:uuid;not null;index"`
	User      User       `json:"-" gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name      string     `json:"name" gorm:"not null"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	Tasks     []Task     `json:"-" gorm:"foreignKey:GroupID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Schedules []Schedule `json:"-" gorm:"foreignKey:GroupID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Schedule struct {
	ID     string `json:"id" gorm:"type:uuid;primaryKey"`
	UserID string `json:"user_id" gorm:"type:uuid;not null;index"`
	User   User   `json:"-" gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	GroupID string    `json:"group_id" gorm:"type:uuid;not null;index"`
	Group   TaskGroup `json:"group,omitempty" gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	Title        string    `json:"title" gorm:"not null"`
	LocationName *string   `json:"location_name,omitempty" gorm:"size:255"`
	StartTime    time.Time `json:"start_time" gorm:"not null;index"`
	EndTime      time.Time `json:"end_time" gorm:"not null"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TaskStatus string

const (
	TaskStatusOpen      TaskStatus = "open"
	TaskStatusCompleted TaskStatus = "completed"
)

type Task struct {
	ID               string     `json:"id" gorm:"type:uuid;primaryKey"`
	UserID           string     `json:"user_id" gorm:"type:uuid;not null;index"`
	User             User       `json:"-" gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	GroupID          *string    `json:"group_id" gorm:"type:uuid"`
	Group            *TaskGroup `json:"group,omitempty"`
	Title            string     `json:"title" gorm:"not null"`
	Description      string     `json:"description"`
	LocationName     *string    `json:"location_name"`
	Deadline         time.Time  `json:"deadline" gorm:"not null;index"`
	EstimatedMinutes int        `json:"estimated_minutes" gorm:"not null"`
	Weight           int        `json:"weight" gorm:"not null;default:1"`
	PriorityScore    float64    `json:"priority_score" gorm:"not null;default:0"`
	Status           TaskStatus `json:"status" gorm:"not null;default:open;index"`
	CompletedAt      *time.Time `json:"completed_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}
