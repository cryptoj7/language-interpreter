# Medical Language Interpreter - Proof of Concept

App deployed [here](https://language-interpreter.vercel.app/)

A real-time medical interpretation system enabling seamless communication between English and Spanish speakers in healthcare settings, powered by OpenAI's Realtime API and Web Speech technologies.

## 🎯 Project Overview

This proof-of-concept demonstrates a comprehensive medical interpretation solution that goes beyond simple translation to provide intelligent action detection, conversation management, and healthcare workflow integration.

## 📋 Deliverables Completed

### ✅ Feature Documentation & Product Rationale

**Core Features Built:**

1. **Real-time Bidirectional Translation** 🌐
   - **Rationale**: Healthcare requires immediate, accurate communication to ensure patient safety and care quality
   - **Implementation**: OpenAI Realtime API with WebRTC for sub-second latency
   - **Languages**: English ↔ Spanish with automatic language detection

2. **Dual-Mode Architecture** 🔄
   - **Demo Mode**: Web Speech API for development and testing
   - **Production Mode**: OpenAI Realtime API for professional deployment
   - **Rationale**: Provides flexibility for different deployment scenarios and cost considerations

3. **Automatic Role Assignment** 👥
   - **Spanish speakers** → Automatically assigned as **Patient**
   - **English speakers** → Automatically assigned as **Doctor**
   - **Rationale**: Streamlines workflow by eliminating manual mode switching

4. **Medical Action Detection & Execution** 🏥
   - **Detected Actions**: Schedule lab work, follow-up appointments, prescriptions, specialist referrals
   - **Webhook Integration**: Real-time action execution via webhook.site
   - **Database Tracking**: Complete audit trail of all detected and executed actions
   - **Rationale**: Transforms conversations into actionable healthcare workflows

5. **"Repeat That" Functionality** 🔄
   - **Multi-language commands**: "repeat that", "repite eso", etc.
   - **Text-to-Speech replay** of last translation
   - **Rationale**: Critical for healthcare where clarity and confirmation are essential

### ✅ Functional Prototype

**Core Communication Features:**
- ✅ Real-time English ↔ Spanish translation
- ✅ Automatic language detection and role assignment
- ✅ WebRTC-based low-latency audio streaming
- ✅ Professional medical terminology preservation
- ✅ Noise filtering and audio quality optimization

### ✅ Feature Complete UI

**Main Interface:**
- Modern, professional medical application design
- Real-time conversation display with role-based styling
- Connection status indicators and controls
- Language detection feedback
- Action detection notifications

**Admin Dashboard:**
- Comprehensive action monitoring and management
- Status filtering (detected, executing, completed, failed)
- Webhook response tracking and error handling
- Timing analysis and retry management
- Manual action testing capabilities

**Conversation History:**
- Complete conversation archives
- Searchable conversation summaries
- Utterance-level detail with timestamps
- Export capabilities for medical records

### ✅ Text-to-Speech Output

**Implementation:**
- **Realtime Mode**: Native OpenAI Realtime API voice synthesis
- **Demo Mode**: Web Speech API with language-specific voices
- **Repeat Functionality**: On-demand replay of translations
- **Voice Selection**: Automatic language-appropriate voice selection

### ✅ Bilingual Conversation Display

**Conversation View:**
- **Doctor utterances**: Blue styling with English/Spanish indicators
- **Patient utterances**: Green styling with language detection
- **AI translations**: Gray styling with clear language labels
- **System actions**: Yellow styling for detected medical actions
- **Timestamps**: Precise timing for medical record keeping

### ✅ Conversation Summaries

**Database Storage:**
- Conversation metadata and status tracking
- Individual utterance storage with role and language
- Action detection and execution logs
- Timing and performance metrics

**Summary Generation:**
- Automatic conversation status tracking
- Action summary with execution status
- Searchable conversation archives

### ✅ Database Storage

**Prisma ORM with SQLite:**

```sql
-- Conversations Table
model Conversation {
  id          String      @id @default(cuid())
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  summary     String?
  status      String      @default("active")
  utterances  Utterance[]
  detectedActions Action[]
}

-- Utterances Table  
model Utterance {
  id              String       @id
  conversationId  String
  role            String       // 'doctor', 'patient', 'system'
  text            String
  originalLang    String       // 'en', 'es'
  translatedText  String?
  timestamp       DateTime
  audioUrl        String?
}

-- Actions Table
model Action {
  id              String       @id @default(cuid())
  conversationId  String
  actionType      String       // 'schedule_lab', 'schedule_followup', etc.
  parameters      String       // JSON parameters
  status          String       // 'detected', 'executing', 'completed', 'failed'
  webhookUrl      String?
  webhookStatus   Int?
  webhookResponse String?
  errorMessage    String?
  detectedAt      DateTime     @default(now())
  executedAt      DateTime?
  completedAt     DateTime?
  retryCount      Int          @default(0)
}
```

### ✅ Intent/Action Recognition & Metadata

**Supported Medical Actions:**

1. **Schedule Lab Work** (`schedule_lab`)
   - Parameters: test type, urgency, patient info
   - Triggers: "blood test", "lab work", "análisis de sangre"

2. **Schedule Follow-up** (`schedule_followup`)
   - Parameters: timeframe, department, reason
   - Triggers: "follow-up", "next appointment", "cita de seguimiento"

3. **Prescribe Medication** (`prescribe_medication`)
   - Parameters: medication, dosage, duration
   - Triggers: "prescription", "medication", "medicina"

4. **Specialist Referral** (`refer_specialist`)
   - Parameters: specialty, urgency, reason
   - Triggers: "specialist", "referral", "especialista"

**Metadata Captured:**
- Detection timestamp and confidence
- Extracted parameters and context
- Execution status and webhook responses
- Error handling and retry attempts
- Complete audit trail for compliance

### ✅ Action Execution via Webhooks

**Webhook Integration:**
- **Endpoint**: https://webhook.site/ (configurable)
- **Payload Format**:
```json
{
  "action": "schedule_lab",
  "parameters": {
    "test": "blood test",
    "urgency": "routine",
    "patient": "current_patient"
  },
  "conversationId": "conv_123",
  "timestamp": "2024-01-15T10:30:00Z",
  "source": "medical-interpreter",
  "actionId": "action_456"
}
```

**Status Tracking:**
- HTTP response codes and timing
- Success/failure logging
- Automatic retry mechanisms
- Error message capture and display



## 🏗️ Technical Design Document

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│   (Next.js)     │◄──►│   (Next.js API)  │◄──►│   (SQLite)      │
│                 │    │                  │    │                 │
│ • React 19      │    │ • Prisma ORM     │    │ • Conversations │
│ • TypeScript    │    │ • OpenAI APIs    │    │ • Utterances    │
│ • Tailwind CSS  │    │ • Webhook Calls  │    │ • Actions       │
│ • Redux Toolkit │    │ • Error Handling │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   OpenAI APIs   │    │   External       │
│                 │    │   Webhooks       │
│ • Realtime API  │    │                  │
│ • Chat API      │    │ • webhook.site   │
│ • Whisper STT   │    │ • Custom URLs    │
│ • TTS           │    │ • Action Exec    │
└─────────────────┘    └──────────────────┘
```

### Performance Optimizations

**1. Audio Processing**
- Voice Activity Detection (VAD) with optimized thresholds
- Noise filtering and silence detection
- Efficient buffer management

**2. Database Queries**
- Indexed conversation and action lookups
- Optimized pagination for conversation history
- Efficient filtering and sorting

**3. Real-time Updates**
- WebSocket-like data channels for instant communication
- Optimistic UI updates with error handling
- Efficient Redux state management

### Security Considerations

**1. API Key Management**
- Environment variable storage
- Server-side API calls only
- Ephemeral token generation

**2. Data Privacy**
- Local SQLite database
- No persistent audio storage
- Configurable data retention

**3. Input Validation**
- Sanitized user inputs
- Type-safe database operations
- Error boundary implementation

### Scalability Design

**1. Modular Architecture**
- Separate components for different modes
- Pluggable translation services
- Configurable action handlers

**2. Database Design**
- Normalized schema with proper relationships
- Indexed queries for performance
- Migration-ready structure

**3. API Design**
- RESTful endpoints with proper HTTP methods
- Consistent error handling
- Extensible webhook system

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd medical-interpreter

# Install dependencies
npm install

# Set up environment variables
# Add your OPENAI_API_KEY and WEBHOOK_SITE_URL

# Initialize database
npx prisma migrate dev --name init

# Start development server
npm run dev
```

### Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key_here
WEBHOOK_SITE_URL=https://webhook.site/your-unique-url
DATABASE_URL="file:./prisma/db.sqlite"
```

## 📊 Usage Examples

### Basic Translation Flow
1. Navigate to http://localhost:3000
2. Click "🚀 Connect & Start Recording"
3. Speak in English or Spanish
4. View real-time translation and role assignment
5. Say "repeat that" to replay last translation

### Medical Action Detection
1. During conversation, mention medical actions:
   - "We need to schedule a blood test"
   - "Necesitamos programar análisis de sangre"
2. View detected actions in the conversation
3. Check admin dashboard for execution status
4. Verify webhook delivery at webhook.site

### Admin Monitoring
1. Navigate to /admin
2. View all detected actions with status
3. Filter by status (detected, executing, completed, failed)
4. Monitor webhook responses and timing
5. Create test actions for verification

## 🔧 API Endpoints

### Conversations
- `POST /api/conversations` - Create/manage conversations
- `GET /api/conversations` - List conversations

### Actions  
- `POST /api/actions` - Create new action
- `GET /api/actions` - List actions with filtering
- `PUT /api/actions` - Update action status

### Realtime
- `GET /api/realtime-token` - Generate ephemeral tokens
- `POST /api/execute-action` - Execute detected actions

## 🧪 Testing



