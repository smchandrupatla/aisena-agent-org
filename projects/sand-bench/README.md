# Sandbench Integration with ISO Message Data

This directory contains the Sandbench implementation for processing ISO 20022 structured message data, specifically focusing on the November 2026 mandate for structured postal addresses.

## Overview

Sandbench provides a framework for:
- Processing ISO 20022 structured messages
- Extracting and validating structured address data
- Performing sanctions screening on structured address fields
- Integrating with the AISENA payments screening pipeline

## Key Components

### 1. ISO Message Processors
- `src/processors/iso_message_processor.py` - Core ISO 20022 message parsing
- `src/processors/address_validator.py` - Structured address validation
- `src/processors/pacs008_parser.py` - ISO 20022 pain.001/pacs.008 message parsing

### 2. Data Analyzers
- `src/analyzers/address_analyzer.py` - Structured address analysis for sanctions screening
- `src/analyzers/name_address_matcher.py` - Name and address matching algorithms
- `src/analyzers/iso20022_compliance_checker.py` - ISO 20022 compliance validation

### 3. Integration Layer
- `src/adapters/kafka_iso_consumer.py` - Kafka consumer for ISO messages
- `src/adapters/opensearch_iso_indexer.py` - OpenSearch indexing for ISO messages
- `src/adapters/database_iso_repository.py` - PostgreSQL repository for ISO messages

## ISO 20022 Structured Address Support

The implementation supports the November 2026 mandate requirements:

### Structured Address Fields
- `street_name` - Street name (ISO 20022: <StrtNm>)
- `town_name` - Town/city name (ISO 20022: <TwnNm>)
- `country` - Country code (ISO 20022: <Ctry>)
- `post_code` - Postal code (ISO 20022: <PstCd>)

### Message Formats
- `pacs.008` - Customer Credit Transfer Initiation
- `pain.001` - Credit Transfer Initiation
- `camt.110` - Case Management

## Integration with AISENA Pipeline

The Sandbench ISO integration connects to the AISENA payments screening pipeline:

1. **Ingestion**: ISO messages are consumed from Kafka topics
2. **Processing**: Structured address data is extracted and validated
3. **Screening**: Address data is used for sanctions screening
4. **Storage**: Processed data is stored in PostgreSQL and OpenSearch
5. **Analysis**: Results are analyzed and indexed for search

## Configuration

### Environment Variables
- `ISO_KAFKA_BOOTSTRAP_SERVERS` - Kafka bootstrap servers
- `ISO_KAFKA_TOPIC` - Kafka topic for ISO messages
- `ISO_OPENSEARCH_URL` - OpenSearch endpoint
- `ISO_POSTGRES_DSN` - PostgreSQL connection string

### Configuration Files
- `config/iso_processor_config.yaml` - ISO processor configuration
- `config/address_validation_rules.yaml` - Address validation rules
- `config/sanctions_screening_config.yaml` - Sanctions screening configuration

## Usage

### Running the ISO Processor
```bash
python -m projects.sand-bench.src.processors.iso_message_processor
```

### Running Address Analysis
```bash
python -m projects.sand-bench.src.analyzers.address_analyzer
```

### Integration with AISENA
```bash
# Start ISO message processor
python scripts/start_iso_processor.py

# Run address analysis
python scripts/run_address_analysis.py
```

## Testing

### Unit Tests
```bash
pytest tests/unit/
```

### Integration Tests
```bash
pytest tests/integration/
```

### End-to-End Tests
```bash
pytest tests/e2e/
```

## Development

### Adding New ISO Message Types
1. Create a new processor in `src/processors/`
2. Implement the ISO message parsing logic
3. Add validation rules in `config/address_validation_rules.yaml`
4. Write unit tests in `tests/unit/`

### Adding New Address Analysis Features
1. Create a new analyzer in `src/analyzers/`
2. Implement the analysis algorithm
3. Add configuration in `config/sanctions_screening_config.yaml`
4. Write integration tests in `tests/integration/`

## Monitoring and Observability

### Metrics
- ISO message processing rate
- Address validation success/failure rates
- Sanctions screening performance
- Integration latency

### Logging
- Structured logging for ISO message processing
- Address validation logs
- Error tracking and alerting

## Future Enhancements

1. **Additional ISO Message Support**: Add support for camt.110 case management messages
2. **Advanced Address Matching**: Implement fuzzy matching for address data
3. **Real-time Processing**: Add streaming processing capabilities
4. **Machine Learning**: Integrate ML models for address risk scoring
5. **Multi-tenancy**: Support for multiple ISO message standards

## License

This project is part of the AISENA ecosystem and is licensed under the same terms as the main repository.