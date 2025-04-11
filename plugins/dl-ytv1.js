import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import yts from 'yt-search'; // For fetching YouTube video details
import axios from 'axios'; // For downloading thumbnails

const execPromise = promisify(exec);

const handler = async (m, { conn, text, args }) => {
    if (!args.length) throw `Please provide a YouTube URL. Example: *!ytmp4 https://youtu.be/example*`;

    const url = args[0];
      
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

    if (!youtubeRegex.test(url)) throw `Invalid YouTube URL.`;

    // Clean up the URL by removing query parameters and extracting the video ID correctly
    const cleanUrl = url.split('?')[0];
    let videoId;

    // Handle YouTube Shorts links
    if (cleanUrl.includes('youtube.com/shorts/')) {
        videoId = cleanUrl.split('/shorts/')[1];
    }
    // Handle YouTube standard or shortened URLs
    else if (cleanUrl.includes('youtu.be/')) {
        videoId = cleanUrl.split('/').pop();
    } 
    // Handle full YouTube URLs
    else if (cleanUrl.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        videoId = urlParams.get('v');
    }

    // If no valid videoId is found, throw an error
    if (!videoId) throw `Couldn't extract video ID. Please check the URL.`;

    // Construct the search query properly for yts
    const searchQuery = `https://youtu.be/${videoId}`;
    const res = await yts(searchQuery);
    const vid = res.videos[0];

    if (!vid) throw `Couldn't fetch video details. Please check the URL.`;

    // Prepare video details
    let txt = `❏ *TITLE* : ${vid.title}\n`;
    txt += `❏ *DURATION* : ${vid.timestamp}\n`;
    txt += `❏ *VIEWS* : ${vid.views}\n`;
    txt += `❏ *AUTHOR* : ${vid.author.name}\n`;
    txt += `❏ *PUBLISHED* : ${vid.ago}\n`;
    txt += `❏ *URL* : https://youtu.be/${vid.videoId}\n\n`;
    txt += `❄ HI, @${m.sender.split('@')[0]},\n\nThank you for using JPS Bot! ❄`;

    // Continue with the rest of your code...

    // Download thumbnail
    const thumbnailUrl = vid.thumbnail;
    const responseImg = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });

    // Combine video details and quality options
    const qualityOptions = `Choose a quality to download:\n1. 360p\n2. 480p\n3. 720p\n4. 1080p\n5. HQ Shorts க்கு மட்டும்\n\nReply with the number (1, 2, 3, 4 or 5). `;
    const combinedMessage = `${txt}\n\n${qualityOptions}`;

    // Send combined message with thumbnail
    const replyKey = await conn.sendFile(
        m.chat,
        Buffer.from(responseImg.data),
        'thumbnail.jpg',
        combinedMessage,
        m
    );

    conn.ytDownloads = conn.ytDownloads || {};
    conn.ytDownloads[m.sender] = {
        url,
        replyKey,
        vid, // Store video details
        timeout: setTimeout(() => {
            conn.reply(m.chat, 'Timeout! Please try again.', m);
            delete conn.ytDownloads[m.sender];
        }, 150 * 1000), // 2.5-minute timeout
    };
};

handler.before = async (m, { conn }) => {
    conn.ytDownloads = conn.ytDownloads || {};
    if (!conn.ytDownloads[m.sender]) return;
    m.react(rwait)
    const { url, replyKey, vid, timeout } = conn.ytDownloads[m.sender]; // Retrieve vid here
    if (!m.quoted || m.quoted.id !== replyKey.id || !m.text) return;

    const userChoice = m.text.trim();
const qualityMap = {
    1: 'bestvideo[height<=360][vcodec=vp9]+bestaudio/best[height<=360][ext=mkv]', // Change ext=mp4 to ext=mkv
    2: 'bestvideo[height<720][vcodec=vp9]+bestaudio/best[height<720][ext=mkv]', // Change ext=mp4 to ext=mkv
    3: 'bestvideo[height<1080][vcodec=vp9]+bestaudio/best[height<1080][ext=mkv]', // Change ext=mp4 to ext=mkv
    4: 'bestvideo[height<=1080][vcodec=vp9]+bestaudio/best[height<=1080][ext=mkv]', // Change ext=mp4 to ext=mkv
    5: 'bestvideo[height<=1920][vcodec=vp9]+bestaudio/best[height<=1920][ext=mkv]', // Change ext=mp4 to ext=mkv
};

    if (!qualityMap[userChoice]) {
        await m.reply('Invalid choice. Please reply with 1, 2, 3, 4 or 5.', m);
        return;
    }

    clearTimeout(timeout); // Clear timeout
    delete conn.ytDownloads[m.sender]; // Clear session

    const quality = qualityMap[userChoice];
    const outputFileName = `${vid.title}.mkv`; // Use .mkv format
    const outputPath = path.resolve(`./${outputFileName}`);

    try {
        const finalPath = await downloadVideo(url, quality, outputPath);
        await uploadFile(finalPath, conn, m);
    } catch (error) {
        await conn.reply(m.chat, `Error Downloading video !!\nTry another url or try command .ytv2`, m);
    } finally {
        // Clean up
        const resolvedPath = path.resolve(outputPath);
        const mkvPath = resolvedPath.replace(/\.mp4$/, '.mkv');
        if (fs.existsSync(resolvedPath)) fs.unlinkSync(resolvedPath);
        if (fs.existsSync(mkvPath)) fs.unlinkSync(mkvPath);
    }
};

// Helper functions

const downloadVideo = async (url, quality, outputPath) => {
    const command = `yt-dlp --cookies "/home/sasi/jps/ytv.txt" -f "${quality}" --merge-output-format mkv -o "${outputPath}" "${url}"`; // Ensure merge-output-format mkv
    console.log(`Executing: ${command}`);

    try {
        const { stdout, stderr } = await execPromise(command);
      
        if (stderr) {
            console.error(`Error downloading video from ${url} (quality: ${quality}):`);
            console.error(stderr);
        } 

        const resolvedPath = path.resolve(outputPath);

        // Check if output file exists
        if (!fs.existsSync(resolvedPath)) {
            // Handle fallback in case of .webm output
            const mkvPath = resolvedPath.replace(/\.mkv$/, '.mkv');
            if (fs.existsSync(mkvPath)) {
                console.warn(`.mkv file found instead of .mp4: ${mkvPath}`);
                return mkvPath; // Return .mkv path if it exists
            }
            throw new Error('Download failed: Output file not found.');
        }

        return resolvedPath; // Return resolved path of .mkv file
    } catch (error) {
        console.error('Download failed:', error.message);
        throw new Error('Download failed: ' + error.message);
    }
};

const uploadFile = async (filePath, conn, m) => {
    let finalFilePath = filePath;
    try {
        const stats = fs.statSync(filePath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        // Conversion logic for files under 100MB
        if (fileSizeInMB < 50) {
            try {
                const convertedPath = filePath.replace(/\.[^.]+$/, '_converted.mp4');
                const ffmpegCommand = `ffmpeg -i "${filePath}" -c:v libx264 -preset fast -c:a aac "${convertedPath}"`;
                
                await execPromise(ffmpegCommand);
                
                if (fs.existsSync(convertedPath)) {
                    // Remove original file
                    fs.unlinkSync(filePath);
                    finalFilePath = convertedPath;
                }
            } catch (convertError) {
                console.error('Conversion error:', convertError);
                // Fall back to original file if conversion fails
            }
        }

        // Send the file
        const fileName = path.basename(finalFilePath);
        const asDocument = true;
        m.react('✅');
        await conn.sendFile(
            m.chat,
            finalFilePath,
            fileName,
            '© JPS',
            m,
            false,
            { asDocument }
        );
    } finally {
        // Cleanup both original and converted files
        if (fs.existsSync(finalFilePath)) {
            fs.unlinkSync(finalFilePath);
        }
    }
};

// Export the handler
handler.help = ['ytmp4', 'ytv'];
handler.tags = ['downloader'];
handler.command = ['ytmp4', 'ytv'];

export default handler;
