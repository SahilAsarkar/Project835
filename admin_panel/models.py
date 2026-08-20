from django.db import models
from accounts.models import Client

class OnboardingStepDefinition(models.Model):
    step_number = models.IntegerField(unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['step_number']

    def __str__(self):
        return f"Step {self.step_number}: {self.title}"


class ClientStepStatus(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('ERROR', 'Error'),
    ]
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='onboarding_steps')
    step = models.ForeignKey(OnboardingStepDefinition, on_delete=models.CASCADE)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='PENDING')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client', 'step')
        ordering = ['step__step_number']


class GoLiveStepDefinition(models.Model):
    step_number = models.IntegerField(unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['step_number']

    def __str__(self):
        return f"Go-Live Step {self.step_number}: {self.title}"


class ClientGoLiveStatus(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('ERROR', 'Error'),
    ]
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='golive_steps')
    step = models.ForeignKey(GoLiveStepDefinition, on_delete=models.CASCADE)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='PENDING')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client', 'step')
        ordering = ['step__step_number']


class ClientTestEnvironment(models.Model):
    client = models.OneToOneField(Client, on_delete=models.CASCADE, related_name='test_environment')
    sftp_host = models.CharField(max_length=255, default='sftp-test.internal')
    sftp_username = models.CharField(max_length=255)
    watched_folder = models.CharField(max_length=255)
    test_status = models.CharField(max_length=50, default='In Progress')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Test Env for {self.client.name}"


class AuditLog(models.Model):
    module = models.CharField(max_length=100)
    action = models.CharField(max_length=100)
    details = models.TextField()
    performed_by = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Optional relation if tied specifically to a client
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.module}] {self.action} by {self.performed_by} at {self.timestamp}"
