# How to Add Events/Fests to Your St. Mary's Website

## Method 1: Direct HTML Editing (Recommended for Homepage Events)

### Step 1: Edit the Events Section
1. Navigate to: `backend-oldd mixed/public/index.html`
2. Find the "Events Section" (around line 1384)
3. Look for this structure:

```html
<!-- Events Section -->
<section class="events-section section-spacing" id="events" style="background: #ffffff;">
    <div class="main-content">
        <h2 class="section-title">Recent Events</h2>
        <p class="section-subtitle">Celebrating achievements and memorable moments in our school community</p>
        <div class="card-grid">
            <!-- Add new event cards here -->
        </div>
    </div>
</section>
```

### Step 2: Add Your New Event Card
Add this template INSIDE the `<div class="card-grid">` section:

```html
<div class="card">
    <div>
        <div style="font-size: 2.5em; margin-bottom: 15px;">🎪</div> <!-- Choose your emoji -->
        <h3>Your Event Name</h3>
        <p class="card-date">Date of Event (e.g., April 15, 2024)</p>
        <p>Description of your event - what happened, achievements, highlights, etc.</p>
    </div>
</div>
```

### Step 3: Popular Event Emojis to Use:
- 🎪 - Festival/Carnival
- 🎭 - Cultural Program
- 🏆 - Sports/Competition
- 🎨 - Art Exhibition
- 🎵 - Music Event
- 🎓 - Graduation/Achievement
- 🌟 - Special Achievement
- 🎉 - Celebration
- 📚 - Academic Event
- 🔬 - Science Fair
| Event Type | Emoji | Example |
|------------|-------|---------|
| Cultural Festival | 🎭 | Diwali, Holi, Christmas |
| Sports Day | 🏆 | Annual Sports, Olympics |
| Science Fair | 🔬 | Science Exhibition |
| Art & Craft | 🎨 | Art Competition |
| Music Concert | 🎵 | Annual Concert |
| Graduation | 🎓 | Farewell Ceremony |
| Prize Distribution | 🏅 | Achievement Day |
| Independence Day | 🇮🇳 | Patriotic Program |
| Teachers Day | 👩‍🏫 | Teacher Appreciation |
| Environmental Day | 🌱 | Tree Plantation |

### Step 4: Example - Adding a "Diwali Festival" Event:

```html
<div class="card">
    <div>
        <div style="font-size: 2.5em; margin-bottom: 15px;">🎆</div>
        <h3>Diwali Festival Celebration</h3>
        <p class="card-date">November 12, 2024</p>
        <p>Students and teachers celebrated the festival of lights with traditional performances, rangoli competition, and cultural programs showcasing our rich heritage.</p>
    </div>
</div>
```

### Step 5: Important Grid Layout Rules:
- The website is designed for **4 events per row** on desktop
- On tablets (1024px): **2 events per row**
- On mobile (768px): **1 event per row**
- If you add a 5th event, it will create a new row
- All cards will automatically have equal height

### Step 6: Commit and Push Changes:
After editing the HTML file:

```bash
cd "cu\st-marys-portal-oldd mixed"
git add "backend-oldd mixed/public/index.html"
git commit -m "Add new event: [Event Name]

- Added [Event Name] to homepage events section
- Event date: [Date]
- Description: [Brief description]"
git push origin main
```

## Method 2: Using Admin Panel (If Available)

### Check if your website has an event management system:
1. Login to your admin panel at: `/login.html`
2. Look for sections like:
   - "Notice Board" - might include events
   - "Admin Panel" - event management
   - "Announcements"

### If you have a notice board system:
- Events might be managed through the notice board
- Check the admin dashboard after logging in
- Look for "Add Notice" or "Add Event" options

## Method 3: Adding Event Images

### If you want to add images to events:
1. Upload image to: `backend-oldd mixed/public/images/`
2. Name it something like: `event-diwali-2024.jpg`
3. Modify the event card HTML:

```html
<div class="card">
    <div>
        <img src="images/event-diwali-2024.jpg" alt="Diwali Festival" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">
        <h3>Diwali Festival Celebration</h3>
        <p class="card-date">November 12, 2024</p>
        <p>Students and teachers celebrated the festival of lights...</p>
    </div>
</div>
```

## Tips for Event Management:

1. **Keep it Updated**: Remove old events and add recent ones regularly
2. **Consistent Dating**: Use format like "Month DD, YYYY"
3. **Brief Descriptions**: Keep descriptions concise but engaging
4. **Visual Appeal**: Choose appropriate emojis or add images
5. **Mobile Friendly**: Test how events look on mobile devices

## Quick Template for Copy-Paste:

```html
<div class="card">
    <div>
        <div style="font-size: 2.5em; margin-bottom: 15px;">🎉</div>
        <h3>EVENT_NAME_HERE</h3>
        <p class="card-date">EVENT_DATE_HERE</p>
        <p>EVENT_DESCRIPTION_HERE</p>
    </div>
</div>
```

Just replace:
- `🎉` with your chosen emoji
- `EVENT_NAME_HERE` with your event name
- `EVENT_DATE_HERE` with the event date
- `EVENT_DESCRIPTION_HERE` with your event description