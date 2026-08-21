from dataclasses import dataclass, field
from decimal import Decimal
from typing import List
from django.db import models

class MirMappingField(models.Model):
    field_id = models.CharField(max_length=50, primary_key=True)
    map_type = models.CharField(max_length=50)
    map_value = models.TextField(blank=True, null=True)
    length = models.IntegerField()
    start = models.IntegerField()
    upper = models.BooleanField(default=False)
    trim = models.BooleanField(default=False)
    truncate = models.BooleanField(default=False)
    align = models.CharField(max_length=10)
    pad = models.CharField(max_length=10)
    fallback_type = models.CharField(max_length=50, blank=True, null=True)
    fallback_value = models.TextField(blank=True, null=True)
    technical_rule = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.field_id

@dataclass
class Adjustment:
    group: str
    reason: str
    amount: Decimal
    quantity: str = ""


@dataclass
class ServiceLine:
    procedure: str = ""
    charge: Decimal = Decimal("0")
    paid: Decimal = Decimal("0")
    units: Decimal = Decimal("1")
    service_date: str = ""
    adjustments: List[Adjustment] = field(default_factory=list)


@dataclass
class Claim:
    claim_number: str = ""
    status: str = ""
    total_charge: Decimal = Decimal("0")
    total_paid: Decimal = Decimal("0")
    patient_responsibility: Decimal = Decimal("0")
    claim_reference: str = ""
    facility_type: str = ""
    claim_frequency: str = ""
    patient_last_name: str = ""
    patient_first_name: str = ""
    patient_middle: str = ""
    subscriber_id: str = ""
    group_number: str = ""
    dob: str = ""
    claim_received_date: str = ""
    adjustments: List[Adjustment] = field(default_factory=list)
    services: List[ServiceLine] = field(default_factory=list)
