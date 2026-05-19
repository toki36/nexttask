package model

import "time"

type TaskGroup struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey"`
	Name      string    `json:"name" gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Tasks     []Task    `json:"-" gorm:"foreignKey:GroupID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

type TaskStatus string

const (
	TaskStatusOpen      TaskStatus = "open"
	TaskStatusCompleted TaskStatus = "completed"
)

type Task struct {
	ID               string     `json:"id" gorm:"type:uuid;primaryKey"`
	GroupID          *string    `json:"group_id" gorm:"type:uuid"`
	Group            *TaskGroup `json:"group,omitempty"`
	Title            string     `json:"title" gorm:"not null"`
	Description      string     `json:"description"`
	Deadline         time.Time  `json:"deadline" gorm:"not null;index"`
	EstimatedMinutes int        `json:"estimated_minutes" gorm:"not null"`
	Weight           int        `json:"weight" gorm:"not null;default:1"`
	PriorityScore    float64    `json:"priority_score" gorm:"not null;default:0"`
	Status           TaskStatus `json:"status" gorm:"not null;default:open;index"`
	CompletedAt      *time.Time `json:"completed_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}
