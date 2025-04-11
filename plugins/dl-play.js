import yts from 'yt-search'; // For YouTube search
import ytvHandler from './dl-ytv1.js'; // Import the .ytv handler
import ytaHandler from './dl-yt1.js'; // Import the .yta handler

const handler = async (m, { conn, text, args }) => {
    if (!text) throw `Please provide a search query. Example: *!yts funny cat videos*`;

    const searchQuery = text.trim();

    let searchResult;
    try {
        searchResult = await yts(searchQuery); // Perform the search
    } catch (error) {
        console.error('Error fetching YouTube search results:', error);
        throw `An error occurred while searching. Please try again later.`;
    }

    if (!searchResult || !searchResult.videos || !searchResult.videos.length) {
        await conn.reply(m.chat, `No results found for "${searchQuery}".`, m);
        return;
    }

    const { videos } = searchResult; // Assign videos from searchResult

    // Prepare the list of video titles
    const resultsText = videos
        .map((video, index) => `*${index + 1}.* ${video.title} (${video.timestamp})\n🔗 https://youtu.be/${video.videoId}`)
        .join('\n\n');

    const fullText = `🔍 *Search Results for:* "${searchQuery}"\n\n${resultsText}\n\nReply with the number of the video you want to download.`;

    // Send the list of results
    const { key } = await conn.reply(m.chat, fullText, m);

    // Store search results for the user
    conn.youtubeSearch = conn.youtubeSearch || {};
    conn.youtubeSearch[m.sender] = {
        videos,
        key,
        timeout: setTimeout(() => {
            delete conn.youtubeSearch[m.sender];
            conn.reply(m.chat, 'Search session expired. Please try again.', m);
        }, 150 * 1000), // 2.5-minute timeout
    };
};

// Unified handler for processing replies
handler.before = async (m, { conn }) => {
    conn.youtubeSearch = conn.youtubeSearch || {};
    conn.youtubeDownloadSession = conn.youtubeDownloadSession || {};

    // Check if the user is selecting a video
    if (conn.youtubeSearch[m.sender]) {
        const { videos, key, timeout } = conn.youtubeSearch[m.sender];
        if (!m.quoted || m.quoted.id !== key.id || !m.text) return;

        const selectedNumber = parseInt(m.text.trim(), 10);
        if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > videos.length) {
            await conn.reply(m.chat, 'Invalid choice. Please select a valid number from the list.', m);
            return;
        }

        clearTimeout(timeout); // Clear timeout as user responded
        delete conn.youtubeSearch[m.sender]; // Clear session

        // Get the selected video's URL
        const selectedVideo = videos[selectedNumber - 1];
        const selectedUrl = `https://youtu.be/${selectedVideo.videoId}`;

        // Prepare download options
        const optionsText = `Choose a format to download:\n1. Video\n2. Audio\n\nReply with the number (1 or 2).`;
        await conn.reply(m.chat, optionsText, m);

        // Store the selected URL for the next choice
        conn.youtubeDownloadSession[m.sender] = {
            selectedUrl,
            timeout: setTimeout(() => {
                delete conn.youtubeDownloadSession[m.sender];
                conn.reply(m.chat, 'Download session expired. Please try again.', m);
            }, 150 * 1000), // 2.5-minute timeout
        };
        return;
    }

    // Check if the user is selecting video or audio download
    if (conn.youtubeDownloadSession[m.sender]) {
        const { selectedUrl, timeout } = conn.youtubeDownloadSession[m.sender];
        if (!m.text) return;

        const choice = parseInt(m.text.trim(), 10);
        if (choice === 1) {
            clearTimeout(timeout);
            delete conn.youtubeDownloadSession[m.sender];
            await ytvHandler(m, { conn, text: selectedUrl, args: [selectedUrl] });
        } else if (choice === 2) {
            clearTimeout(timeout);
            delete conn.youtubeDownloadSession[m.sender];
            await ytaHandler(m, { conn, text: selectedUrl, args: [selectedUrl] });
        } else {
            await conn.reply(m.chat, 'Invalid choice. Reply with 1 for video or 2 for audio.', m);
        }
    }
};

handler.help = ['yts'];
handler.tags = ['search'];
handler.command = ['yts']; // Command for video search
export default handler;