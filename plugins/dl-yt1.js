import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const downloadAudioWithYtDlp = async (url, outputPath, cookiesPath = null) => {
    try {
        // Build the yt-dlp command dynamically
        const cookieOption = cookiesPath ? `--cookies "${cookiesPath}"` : '';
        const command = `yt-dlp "${url}" ${cookieOption} -f bestaudio --extract-audio --audio-format mp3 --embed-thumbnail -o "${outputPath}"`;
        console.log(`Executing command: ${command}`);
        await execPromise(command);
    } catch (error) {
        console.error('yt-dlp Error:', error);
        throw new Error('Failed to download audio using yt-dlp.');
    }
};

const getVideoTitle = async (url, cookiesPath = null) => {
    try {
        const cookieOption = cookiesPath ? `--cookies "${cookiesPath}"` : '';
        const command = `yt-dlp "${url}" ${cookieOption} --print title`;
        const { stdout } = await execPromise(command);
        return stdout.trim(); // Return the cleaned title
    } catch (error) {
        console.error('Error fetching video title:', error);
        throw new Error('Failed to fetch video title.');
    }
};

const sanitizeFileName = (title) => {
    // Replace invalid file name characters with underscores
    const sanitized = title.replace(/[<>:"/\\|?*]+/g, '_');
    // Limit the file name length to 100 characters (adjust as needed)
    return sanitized.substring(0, 100);
};

const handler = async (m, { args, conn }) => {
    if (!args.length) {
        await m.reply('Please provide a YouTube URL.');
        return;
    }

    const url = args.join(' ');
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    let outputPath; // Declare outputPath outside try block

    if (!youtubeRegex.test(url)) {
        await m.react('❌');
        await m.reply('Invalid YouTube URL. Please provide a valid URL.');
        return;
    }

    await m.react('⏳');

    const cookiesPath = path.resolve('/home/sasi/jps/ytv.txt');

    try {
        // Fetch the video title
        const videoTitle = await getVideoTitle(url, fs.existsSync(cookiesPath) ? cookiesPath : null);
        const safeTitle = sanitizeFileName(videoTitle); // Sanitize and limit the title
        const outputPath = path.join(__dirname, `${safeTitle}.mp3`);

        // Download and convert the audio
        await downloadAudioWithYtDlp(url, outputPath, fs.existsSync(cookiesPath) ? cookiesPath : null);


const caption = `© JPS`;
// Send the file as a document to avoid compression
await conn.sendMessage(
    m.chat,
    {
        document: { url: outputPath }, // Use the local file path as the URL
        mimetype: 'audio/mpeg', // Explicit MIME type for MP3
        fileName: path.basename(outputPath), // Set the file name
        caption: caption, // Add the caption
    },
    { quoted: m } // Optional: Quote the original message
);
        await m.react('✅');
    } catch (error) {
        console.error('Error fetching audio:', error.message);
        await m.reply(`⏱️ Error: Error downloading audio from ${url}: ${error.message}`);
        await m.react('❌');
    } finally {
        // Cleanup the downloaded file if it exists
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
    }
};

handler.help = ['ytmp3', 'yta3'];
handler.tags = ['dl'];
handler.command = ['ytmp3', 'yta3'];

export default handler;