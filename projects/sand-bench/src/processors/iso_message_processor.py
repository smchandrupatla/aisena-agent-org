"""
ISO 20022 Message Processor for Sandbench

This module processes ISO 20022 structured messages, specifically focusing on
the November 2026 mandate for structured postal addresses.
"""

import json
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class ISOMessageType(Enum):
    """ISO 20022 message types supported by Sandbench"""
    PACS_008 = "pacs.008"  # Customer Credit Transfer Initiation
    PAIN_001 = "pain.001"  # Credit Transfer Initiation
    CAMT_110 = "camt.110"  # Case Management
    MT101 = "mt101"        # Legacy MT101 (for backward compatibility)

@dataclass
class StructuredAddress:
    """Structured address data conforming to ISO 20022 PostalAddress22"""
    street_name: Optional[str] = None
    town_name: Optional[str] = None
    country: Optional[str] = None
    post_code: Optional[str] = None
    building_number: Optional[str] = None
    department: Optional[str] = None
    sub_department: Optional[str] = None
    street_building_name: Optional[str] = None
    floor: Optional[str] = None
    unit: Optional[str] = None
    room: Optional[str] = None
    post_box: Optional[str] = None
    care_of: Optional[str] = None
    recipient_name: Optional[str] = None

@dataclass
class ISOParty:
    """ISO 20022 Party (Debtor or Creditor)"""
    name: str
    address: Optional[StructuredAddress] = None
    account_number: Optional[str] = None
    financial_institution: Optional[Dict[str, Any]] = None

@dataclass
class ISO20022Message:
    """ISO 20022 structured message"""
    message_type: ISOMessageType
    message_id: str
    creation_date_time: str
    debtor: Optional[ISOParty] = None
    creditor: Optional[ISOParty] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    transaction_id: Optional[str] = None
    reference: Optional[str] = None
    raw_xml: Optional[str] = None
    raw_json: Optional[Dict[str, Any]] = None

class ISOMessageProcessor:
    """
    Processes ISO 20022 structured messages for Sandbench.
    
    This processor handles:
    - Parsing ISO 20022 XML/JSON messages
    - Extracting structured address data
    - Validating address format compliance
    - Converting to Sandbench internal format
    """
    
    def __init__(self):
        self.supported_message_types = [
            ISOMessageType.PACS_008,
            ISOMessageType.PAIN_001,
            ISOMessageType.CAMT_110,
            ISOMessageType.MT101,
        ]
        logger.info("ISO Message Processor initialized")
    
    def process_message(self, message_data: Dict[str, Any]) -> ISO20022Message:
        """
        Process an ISO 20022 message from raw data.
        
        Args:
            message_data: Raw message data (XML string or JSON dict)
            
        Returns:
            ISO20022Message: Parsed and structured message
            
        Raises:
            ValueError: If message format is invalid or unsupported
        """
        try:
            # Determine message type and parse accordingly
            if isinstance(message_data, dict):
                return self._parse_json_message(message_data)
            elif isinstance(message_data, str):
                return self._parse_xml_message(message_data)
            else:
                raise ValueError(f"Unsupported message data type: {type(message_data)}")
                
        except Exception as e:
            logger.error(f"Failed to process ISO message: {e}")
            raise
    
    def _parse_json_message(self, data: Dict[str, Any]) -> ISO20022Message:
        """Parse ISO 20022 message from JSON format."""
        # Extract message type from data
        message_type_str = data.get('message_type', 'pacs.008')
        try:
            message_type = ISOMessageType(message_type_str.lower())
        except ValueError:
            logger.warning(f"Unknown message type {message_type_str}, defaulting to pacs.008")
            message_type = ISOMessageType.PACS_008
        
        # Extract structured address data
        debtor = self._parse_party(data.get('debtor'))
        creditor = self._parse_party(data.get('creditor'))
        
        # Create ISO20022Message object
        message = ISO20022Message(
            message_type=message_type,
            message_id=data.get('message_id', ''),
            creation_date_time=data.get('creation_date_time', ''),
            debtor=debtor,
            creditor=creditor,
            amount=data.get('amount'),
            currency=data.get('currency'),
            transaction_id=data.get('transaction_id'),
            reference=data.get('reference'),
            raw_json=data
        )
        
        logger.info(f"Parsed ISO message: {message.message_type.value} - {message.message_id}")
        return message
    
    def _parse_xml_message(self, xml_data: str) -> ISO20022Message:
        """Parse ISO 20022 message from XML format."""
        # For now, convert XML to JSON using a simple approach
        # In production, use a proper XML parser
        try:
            # Simple XML to JSON conversion (placeholder)
            # This should be replaced with a proper XML parser
            import xml.etree.ElementTree as ET
            root = ET.fromstring(xml_data)
            
            # Convert XML to dict (simplified)
            data = self._xml_to_dict(root)
            return self._parse_json_message(data)
            
        except Exception as e:
            logger.error(f"Failed to parse XML message: {e}")
            raise
    
    def _xml_to_dict(self, element) -> Dict[str, Any]:
        """Convert XML element to dictionary (simplified)."""
        result = {}
        for child in element:
            if len(child) > 0:
                result[child.tag] = self._xml_to_dict(child)
            else:
                result[child.tag] = child.text
        return result
    
    def _parse_party(self, party_data: Optional[Dict[str, Any]]) -> Optional[ISOParty]:
        """Parse ISO party data (Debtor or Creditor)."""
        if not party_data:
            return None
        
        # Parse structured address
        address_data = party_data.get('address', {})
        address = self._parse_structured_address(address_data) if address_data else None
        
        return ISOParty(
            name=party_data.get('name', ''),
            address=address,
            account_number=party_data.get('account_number'),
            financial_institution=party_data.get('financial_institution')
        )
    
    def _parse_structured_address(self, address_data: Dict[str, Any]) -> StructuredAddress:
        """Parse structured address data from ISO 20022 format."""
        return StructuredAddress(
            street_name=address_data.get('street_name'),
            town_name=address_data.get('town_name'),
            country=address_data.get('country'),
            post_code=address_data.get('post_code'),
            building_number=address_data.get('building_number'),
            department=address_data.get('department'),
            sub_department=address_data.get('sub_department'),
            street_building_name=address_data.get('street_building_name'),
            floor=address_data.get('floor'),
            unit=address_data.get('unit'),
            room=address_data.get('room'),
            post_box=address_data.get('post_box'),
            care_of=address_data.get('care_of'),
            recipient_name=address_data.get('recipient_name')
        )
    
    def validate_address_compliance(self, message: ISO20022Message) -> Dict[str, Any]:
        """
        Validate that the message complies with ISO 20022 address requirements.
        
        Args:
            message: ISO20022Message to validate
            
        Returns:
            Dict containing validation results
        """
        validation_results = {
            'is_valid': True,
            'errors': [],
            'warnings': [],
            'compliance_score': 100.0
        }
        
        # Check debtor address compliance
        if message.debtor and message.debtor.address:
            debtor_errors = self._validate_structured_address(message.debtor.address, 'debtor')
            validation_results['errors'].extend(debtor_errors['errors'])
            validation_results['warnings'].extend(debtor_errors['warnings'])
            validation_results['compliance_score'] -= len(debtor_errors['errors']) * 10
        
        # Check creditor address compliance
        if message.creditor and message.creditor.address:
            creditor_errors = self._validate_structured_address(message.creditor.address, 'creditor')
            validation_results['errors'].extend(creditor_errors['errors'])
            validation_results['warnings'].extend(creditor_errors['warnings'])
            validation_results['compliance_score'] -= len(creditor_errors['errors']) * 10
        
        # Overall validation result
        validation_results['is_valid'] = len(validation_results['errors']) == 0
        validation_results['compliance_score'] = max(0.0, validation_results['compliance_score'])
        
        if not validation_results['is_valid']:
            logger.warning(f"ISO message validation failed: {validation_results}")
        
        return validation_results
    
    def _validate_structured_address(self, address: StructuredAddress, party_name: str) -> Dict[str, Any]:
        """Validate a structured address for ISO 20022 compliance."""
        errors = []
        warnings = []
        
        # Required fields for November 2026 mandate
        required_fields = ['town_name', 'country']
        for field in required_fields:
            if not getattr(address, field):
                errors.append(f"{party_name} address missing required field: {field}")
        
        # Validate country code format (ISO 3166-1 alpha-2)
        if address.country and len(address.country) != 2:
            warnings.append(f"{party_name} address country code should be 2 characters (ISO 3166-1 alpha-2)")
        
        # Validate postal code format (varies by country)
        if address.post_code:
            if len(address.post_code) < 2 or len(address.post_code) > 10:
                warnings.append(f"{party_name} address postal code length seems unusual: {address.post_code}")
        
        # Validate town name
        if address.town_name and len(address.town_name.strip()) == 0:
            warnings.append(f"{party_name} address town_name should not be empty")
        
        return {
            'errors': errors,
            'warnings': warnings,
            'is_valid': len(errors) == 0
        }
    
    def extract_screening_data(self, message: ISO20022Message) -> Dict[str, Any]:
        """
        Extract data needed for sanctions screening from ISO message.
        
        Args:
            message: ISO20022Message to extract data from
            
        Returns:
            Dict containing screening data
        """
        screening_data = {
            'message_id': message.message_id,
            'transaction_id': message.transaction_id,
            'amount': message.amount,
            'currency': message.currency,
            'timestamp': message.creation_date_time,
            'screening_candidates': []
        }
        
        # Add debtor data for screening
        if message.debtor:
            debtor_screening = {
                'party_type': 'debtor',
                'name': message.debtor.name,
                'address': self._format_address_for_screening(message.debtor.address) if message.debtor.address else None,
                'account_number': message.debtor.account_number
            }
            screening_data['screening_candidates'].append(debtor_screening)
        
        # Add creditor data for screening
        if message.creditor:
            creditor_screening = {
                'party_type': 'creditor',
                'name': message.creditor.name,
                'address': self._format_address_for_screening(message.creditor.address) if message.creditor.address else None,
                'account_number': message.creditor.account_number
            }
            screening_data['screening_candidates'].append(creditor_screening)
        
        return screening_data
    
    def _format_address_for_screening(self, address: StructuredAddress) -> Dict[str, Any]:
        """Format structured address for sanctions screening."""
        return {
            'street_name': address.street_name,
            'town_name': address.town_name,
            'country': address.country,
            'post_code': address.post_code,
            'full_address': self._format_full_address(address)
        }
    
    def _format_full_address(self, address: StructuredAddress) -> str:
        """Format full address for display and matching."""
        parts = []
        if address.street_name:
            parts.append(address.street_name)
        if address.town_name:
            parts.append(address.town_name)
        if address.post_code:
            parts.append(address.post_code)
        if address.country:
            parts.append(address.country)
        
        return ', '.join(parts) if parts else ''

# Singleton instance for use throughout the application
iso_processor = ISOMessageProcessor()