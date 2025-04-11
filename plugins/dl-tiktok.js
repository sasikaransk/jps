import fetch from 'node-fetch';
import wget from 'wget-improved';
import fs from 'fs';

const handler = async (message, { conn, args }) => {
  // Check if the URL is provided in the command arguments
  if (!args[0]) {
    throw '✳️ Enter the TikTok link next to the command';
  }



  // React with a loading emoji to show the process has started
  await message.react('⏳');

  try {
    // The URL of the TikTok video
    const url = args[0];
    console.log('URL:', url);

    // Fetch media data using the API
    const api_url = `https://api-pink-venom.vercel.app/api/tiktok?url=${url}`;
    const response = await fetch(api_url);
    const data = await response.json();

    // Check if the media data has a valid video URL
    if (!data.status || !data.result || !data.result.no_wm) {
      throw new Error('Could not fetch the video URL');
    }

    const no_wm_url = data.result.no_wm;
    console.log('Video URL:', no_wm_url);

    // Download the video using wget
    const filename = `tiktok_video_${Date.now()}.mp4`;
    const download = wget.download(no_wm_url, filename);

    download.on('end', async () => {
      console.log('Download complete');
      // Send the video to the WhatsApp chat
      await conn.sendFile(
        message.chat,
        filename,
        'tiktok.mp4',
        '*©JPS*',
        message,
        false,
        { mimetype: 'video/mp4' }
      );
      // React with a success emoji
      await message.react('✅');
      // Delete the file after sending
      fs.unlinkSync(filename);
    });

    download.on('error', async (err) => {
      console.error('Download error:', err);
      await message.reply('⚠️ An error occurred while processing the request. Please try again later.');
      await message.react('❌');
    });
  } catch (error) {
    // Log and handle any errors
    console.error('Error downloading from TikTok:', error.message, error.stack);
    await message.reply('⚠️ An error occurred while processing the request. Please try again later.');
    await message.react('❌');
  }
};

// Define command metadata
handler.help = ['tiktok', 'tt', 'tikdown', 'ttdl'];
handler.tags = ['downloader'];
handler.command = ['tiktok', 'tt', 'tikdown', 'ttdl'];

export default handler;
